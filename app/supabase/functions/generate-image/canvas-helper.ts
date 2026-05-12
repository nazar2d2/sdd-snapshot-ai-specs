// Lazy-load ImageScript to avoid WASM compilation crashes at module init
// deno-lint-ignore no-explicit-any
let _ImageClass: any = null;
async function loadImageScript() {
  if (!_ImageClass) {
    const mod = await import("https://deno.land/x/imagescript@1.3.0/mod.ts");
    _ImageClass = mod.Image;
  }
  return _ImageClass;
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000; // 32KB
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// ============================================================================
// SERVER-SIDE FULL-BLEED CANVAS (1:1 BLURRED COVER FIX - AGGRESSIVE 105%)
// ============================================================================
export async function createFullBleedCanvas(
  imageUrl: string,
  targetW: number,
  targetH: number,
  fillStrategy: "studio" | "mirror",
  backgroundColor: string,
  overscan: number = 1.0,
): Promise<{ ok: boolean; imageUrl: string; error?: string }> {
  try {
    const Image = await loadImageScript();

    const resp = await fetch(imageUrl);
    if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.statusText}`);
    const arrayBuffer = await resp.arrayBuffer();

    const image = await Image.decode(new Uint8Array(arrayBuffer));

    // Overscan: trim edges by scaling crop area slightly inward (removes AI-generated borders)
    const effectiveW = overscan > 1.0 ? Math.round(image.width / overscan) : image.width;
    const effectiveH = overscan > 1.0 ? Math.round(image.height / overscan) : image.height;
    if (overscan > 1.0) {
      const trimX = Math.floor((image.width - effectiveW) / 2);
      const trimY = Math.floor((image.height - effectiveH) / 2);
      image.crop(trimX, trimY, effectiveW, effectiveH);
      console.log(`[BLEED] Overscan ${overscan}x applied: trimmed to ${effectiveW}x${effectiveH}`);
    }

    // Cover-crop: scale to fill entire target, then center-crop (no borders)
    const targetAspect = targetW / targetH;
    let cropW = image.width;
    let cropH = image.height;

    if (image.width / image.height > targetAspect) {
      cropW = Math.round(image.height * targetAspect);
    } else {
      cropH = Math.round(image.width / targetAspect);
    }

    const cx = Math.floor((image.width - cropW) / 2);
    const cy = Math.floor((image.height - cropH) / 2);

    image.crop(cx, cy, cropW, cropH);
    image.resize(targetW, targetH);

    const pngBuffer = await image.encode(1);
    const base64 = uint8ToBase64(pngBuffer);
    return { ok: true, imageUrl: `data:image/png;base64,${base64}` };
  } catch (e: any) {
    console.error("Full-bleed error:", e);
    return { ok: false, imageUrl, error: e.message };
  }
}

// Helper: Deterministic Crop (Center weighted)
export async function smartCrop(
  imageUrl: string,
  targetW: number,
  targetH: number
): Promise<{ ok: boolean; imageUrl: string }> {
  try {
    const Image = await loadImageScript();

    const resp = await fetch(imageUrl);
    const arrayBuffer = await resp.arrayBuffer();
    const image = await Image.decode(new Uint8Array(arrayBuffer));

    const targetAspect = targetW / targetH;
    let cropW = image.width;
    let cropH = image.height;

    if (image.width / image.height > targetAspect) {
      cropW = Math.round(image.height * targetAspect);
    } else {
      cropH = Math.round(image.width / targetAspect);
    }

    const x = Math.floor((image.width - cropW) / 2);
    const y = Math.floor((image.height - cropH) / 2);

    image.crop(x, y, cropW, cropH);
    image.resize(targetW, targetH);

    const pngBuffer = await image.encode(1);
    const base64 = uint8ToBase64(pngBuffer);
    return { ok: true, imageUrl: `data:image/png;base64,${base64}` };
  } catch (e: any) {
    console.error("Smart crop error:", e);
    return { ok: false, imageUrl: imageUrl };
  }
}

// ============================================================================
// PRODUCT-FOCUSED DETERMINISTIC CROP (ASPECT-RATIO-AWARE, BALANCED ZOOM-OUT)
// ============================================================================

type AspectCategory = "square" | "portrait" | "landscape";

function classifyAspectRatio(aspectRatio: string): AspectCategory {
  const parts = aspectRatio.split(":").map(Number);
  if (parts.length !== 2 || !parts[0] || !parts[1]) return "square";
  const ratio = parts[0] / parts[1];
  if (ratio < 0.9) return "portrait";  // taller than wide (e.g. 9:16, 2:3, 4:5)
  if (ratio > 1.1) return "landscape"; // wider than tall (e.g. 16:9, 21:9, 3:2)
  return "square";
}

// Aspect-ratio-aware crop windows — gentler for non-square formats
function getProductCropWindow(productType: string, aspectRatio: string): { top: number; bottom: number } | null {
  const cat = classifyAspectRatio(aspectRatio);

  const windows: Record<string, Record<AspectCategory, { top: number; bottom: number }>> = {
    top: {
      square:    { top: 0.0, bottom: 0.95 },  // loosened from 0.90 — more breathing room below hem
      portrait:  { top: 0.0, bottom: 1.0 },   // no crop
      landscape: { top: 0.0, bottom: 1.0 },   // no vertical crop for wide formats
    },
    bottom: {
      square:    { top: 0.05, bottom: 1.0 },  // loosened to preserve more torso above waistband
      portrait:  { top: 0.0, bottom: 1.0 },   // no top crop — full view
      landscape: { top: 0.0, bottom: 1.0 },   // no crop — preserve full legs+shoes
    },
    shoes: {
      square:    { top: 0.15, bottom: 1.0 },
      portrait:  { top: 0.10, bottom: 1.0 },
      landscape: { top: 0.05, bottom: 1.0 },
    },
    outfit: {
      square:    { top: 0.0, bottom: 1.0 },  // no crop for outfit
      portrait:  { top: 0.0, bottom: 1.0 },
      landscape: { top: 0.0, bottom: 1.0 },
    },
  };

  return windows[productType]?.[cat] ?? null;
}

export async function enforceProductFocusedCrop(
  imageUrl: string,
  targetW: number,
  targetH: number,
  productType: string,
  aspectRatio: string = "1:1",
): Promise<{ ok: boolean; imageUrl: string; error?: string }> {
  try {
    const window = getProductCropWindow(productType, aspectRatio);
    if (!window) {
      return { ok: true, imageUrl }; // Unknown type, skip
    }

    // Skip crop entirely for outfit (window covers 100%)
    if (window.top === 0 && window.bottom === 1.0) {
      console.log(`[CROP] Skipping product crop for ${productType} (${aspectRatio}) — full window`);
      return { ok: true, imageUrl };
    }

    const Image = await loadImageScript();
    const resp = await fetch(imageUrl);
    if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.statusText}`);
    const arrayBuffer = await resp.arrayBuffer();
    const image = await Image.decode(new Uint8Array(arrayBuffer));

    const cropY = Math.floor(image.height * window.top);
    const cropH = Math.floor(image.height * (window.bottom - window.top));
    const cropW = image.width;

    // Crop the vertical window
    image.crop(0, cropY, cropW, cropH);

    // Now cover-crop to exact target aspect ratio
    const targetAspect = targetW / targetH;
    let finalCropW = image.width;
    let finalCropH = image.height;

    if (image.width / image.height > targetAspect) {
      finalCropW = Math.round(image.height * targetAspect);
    } else {
      finalCropH = Math.round(image.width / targetAspect);
    }

    const cx = Math.floor((image.width - finalCropW) / 2);
    const cy = Math.floor((image.height - finalCropH) / 2);

    image.crop(cx, cy, finalCropW, finalCropH);
    image.resize(targetW, targetH);

    const pngBuffer = await image.encode(1);
    const base64 = uint8ToBase64(pngBuffer);

    console.log(`[CROP] Product-focused crop applied: ${productType} (${aspectRatio}/${classifyAspectRatio(aspectRatio)}) window [${window.top}-${window.bottom}]`);
    return { ok: true, imageUrl: `data:image/png;base64,${base64}` };
  } catch (e: any) {
    console.error("Product-focused crop error:", e);
    return { ok: false, imageUrl, error: e.message };
  }
}

// ============================================================================
// POST-PROCESSING COLOR TRANSFER (GUARANTEED COLOR MATCHING)
// ============================================================================
export async function transferGarmentColor(
  generatedImageUrl: string,
  referenceImageUrl: string,
  targetColor: string | null,
): Promise<{ ok: boolean; imageUrl: string | null; error: string | null }> {
  try {
    const Image = await loadImageScript();

    console.log(`[COLOR TRANSFER] Starting - targetColor: ${targetColor || 'sample from reference'}`);

    const [generatedResp, referenceResp] = await Promise.all([
      fetch(generatedImageUrl),
      fetch(referenceImageUrl),
    ]);

    if (!generatedResp.ok || !referenceResp.ok) {
      throw new Error(`Failed to fetch images`);
    }

    const [generated, reference] = await Promise.all([
      Image.decode(new Uint8Array(await generatedResp.arrayBuffer())),
      Image.decode(new Uint8Array(await referenceResp.arrayBuffer())),
    ]);

    let targetRGB: [number, number, number];

    if (targetColor) {
      targetRGB = hexToRGB(targetColor);
      console.log(`[COLOR TRANSFER] Using hex color: ${targetColor} -> RGB${JSON.stringify(targetRGB)}`);
    } else {
      targetRGB = sampleDominantGarmentColor(reference);
      console.log(`[COLOR TRANSFER] Sampled from reference: RGB${JSON.stringify(targetRGB)}`);
    }

    const garmentMask = detectGarmentRegion(generated);
    const garmentPixels = garmentMask.flat().filter((p: boolean) => p).length;
    console.log(`[COLOR TRANSFER] Detected ${garmentPixels} garment pixels`);

    const recolored = recolorGarment(generated, garmentMask, targetRGB);

    const encoded = await recolored.encode(1);
    const base64 = uint8ToBase64(new Uint8Array(encoded));
    const dataUrl = `data:image/png;base64,${base64}`;

    console.log(`[COLOR TRANSFER] Success`);
    return { ok: true, imageUrl: dataUrl, error: null };
  } catch (err: any) {
    console.error(`[COLOR TRANSFER] Failed:`, err);
    return { ok: false, imageUrl: null, error: String(err) };
  }
}

function hexToRGB(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

// deno-lint-ignore no-explicit-any
function sampleDominantGarmentColor(refImage: any): [number, number, number] {
  const w = refImage.width;
  const h = refImage.height;

  const samples: number[][] = [];
  const stepY = Math.max(1, Math.floor(h / 20));
  const stepX = Math.max(1, Math.floor(w / 20));

  for (let y = Math.floor(h * 0.3); y < Math.floor(h * 0.7); y += stepY) {
    for (let x = Math.floor(w * 0.3); x < Math.floor(w * 0.7); x += stepX) {
      const pixel = refImage.getPixelAt(x + 1, y + 1);
      const r = (pixel >> 24) & 0xFF;
      const g = (pixel >> 16) & 0xFF;
      const b = (pixel >> 8) & 0xFF;
      samples.push([r, g, b]);
    }
  }

  if (samples.length === 0) {
    return [128, 128, 128];
  }

  return [
    median(samples.map(s => s[0])),
    median(samples.map(s => s[1])),
    median(samples.map(s => s[2])),
  ];
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// deno-lint-ignore no-explicit-any
function detectGarmentRegion(img: any): boolean[][] {
  const w = img.width;
  const h = img.height;
  const mask: boolean[][] = [];

  const corners = [
    img.getPixelAt(1, 1),
    img.getPixelAt(w, 1),
    img.getPixelAt(1, h),
    img.getPixelAt(w, h),
  ];

  let bgR = 0, bgG = 0, bgB = 0;
  for (const pixel of corners) {
    bgR += (pixel >> 24) & 0xFF;
    bgG += (pixel >> 16) & 0xFF;
    bgB += (pixel >> 8) & 0xFF;
  }
  bgR /= 4; bgG /= 4; bgB /= 4;

  const threshold = 50;

  for (let y = 0; y < h; y++) {
    mask[y] = [];
    for (let x = 0; x < w; x++) {
      const pixel = img.getPixelAt(x + 1, y + 1);
      const r = (pixel >> 24) & 0xFF;
      const g = (pixel >> 16) & 0xFF;
      const b = (pixel >> 8) & 0xFF;
      const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
      mask[y][x] = diff > threshold;
    }
  }

  return mask;
}

function recolorGarment(
  // deno-lint-ignore no-explicit-any
  img: any,
  mask: boolean[][],
  targetRGB: [number, number, number]
  // deno-lint-ignore no-explicit-any
): any {
  const result = img.clone();
  const [targetH, targetS, _] = rgbToHSV(...targetRGB);

  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (mask[y] && mask[y][x]) {
        const pixel = img.getPixelAt(x + 1, y + 1);
        const r = (pixel >> 24) & 0xFF;
        const g = (pixel >> 16) & 0xFF;
        const b = (pixel >> 8) & 0xFF;
        const a = pixel & 0xFF;

        const [_h, _s, v] = rgbToHSV(r, g, b);
        const [newR, newG, newB] = hsvToRGB(targetH, targetS, v);

        const newPixel = ((newR & 0xFF) << 24) | ((newG & 0xFF) << 16) | ((newB & 0xFF) << 8) | (a & 0xFF);
        result.setPixelAt(x + 1, y + 1, newPixel);
      }
    }
  }

  return result;
}

function rgbToHSV(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : d / max;
  const v = max;

  return [h, s, v];
}

function hsvToRGB(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;

  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}
