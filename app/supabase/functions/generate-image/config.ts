import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import type { FormatSpec, GarmentMasks, NormalizedView, ProductType } from "./types.ts";

// Engine IDs — Google Generative AI model names (direct API, no gateway prefix)
export const ENGINE = "nano-banana-2";
export const HD_ENGINE = "nano-banana-2";
export const FAST_ENGINE = "nano-banana-2";

// ── Image limits ─────────────────────────────────────────────────────────────
export const MAX_IMAGES_PER_JOB = 16;

// ── Resolution tiers ─────────────────────────────────────────────────────────
export const DEFAULT_RESOLUTION = "1K" as const;  // Standard: 1024px
export const HD_RESOLUTION = "2K" as const;        // HD: 2048px
export const HD_CREDIT_MULTIPLIER = 3;             // HD costs 3 credits per image

// ── Speed SLA ────────────────────────────────────────────────────────────────
export const SPEED_SLA = {
  baseRenderTimeoutMs: 90_000,
  hdRenderTimeoutMs: 180_000,       // 2K renders get 3 min per call (within 230s function limit)
  upscaleTimeoutMs: 0,
  transformTimeoutMs: 25_000,
  validateTimeoutMs: 15_000,
  perImageTimeoutMs: 120_000,
  totalImageSlaMs: 300_000,
  validationTimeoutMs: 15_000,

  baseRenderConcurrency: 8,
  upscaleConcurrency: 8,
  workerPoolSize: 10,
  providerSpacingMs: 200,
  backoffMs: [500, 1000] as number[],
  hdBackoffMs: [3000, 8000, 15000, 30000, 60000] as number[],  // HD tasks get longer requeue delays
  baseResolution: 1024,
  upscaleResolution: 3072,
  colorEditMaxRetries: 2,

  useFastPresetOnTimeout: false,
};

// ── Quality Gate ─────────────────────────────────────────────────────────────
export const QUALITY_GATE_CONFIG = {
  minLongEdge: 3072,
  sharpnessThreshold: 0.65,
  productSimilarityThreshold: 0.88,
  artifactThreshold: 0.2,
  enableQualityGate: true,
  enableProductGate: true,
  enableRecolorGate: true,
  maxRetryMain: 2,
  maxRetryRecovery: 1,
};

// ── Rate Limiting ────────────────────────────────────────────────────────────
export const RATE_LIMIT_CONFIG = {
  fullRenderConcurrency: SPEED_SLA.baseRenderConcurrency,
  imageEditConcurrency: SPEED_SLA.upscaleConcurrency,
  providerSpacingMs: SPEED_SLA.providerSpacingMs,
  maxAttempts: 5,
  hdMaxAttempts: 8,
  backoffScheduleMs: SPEED_SLA.backoffMs,
  recoveryTimeoutMs: SPEED_SLA.baseRenderTimeoutMs,
  throttledSpacingMs: 500,
  throttleDurationMs: 15_000,
  perCallTimeoutMs: SPEED_SLA.baseRenderTimeoutMs,
  layoutValidationRetries: 0,
};

// ── Format Lock ──────────────────────────────────────────────────────────────
export const FORMAT_SPECS: Record<string, FormatSpec> = {
  "1:1": {
    aspect: "1:1",
    width: 2048,
    height: 2048,
    tolerance: 0.005,
    promptDirective:
      "STRICT SQUARE 1:1 FORMAT - width EQUALS height exactly (2048x2048 pixels). Canvas must be perfectly square.",
    compositionHint:
      "square composition, centered layout, equal margins on all sides, model perfectly centered in frame",
  },
  "4:5": {
    aspect: "4:5",
    width: 2048,
    height: 2560,
    tolerance: 0.005,
    promptDirective:
      "STRICT PORTRAIT 4:5 FORMAT - exactly 2048x2560 pixels. Vertical orientation, width:height = 0.8:1.",
    compositionHint: "vertical portrait composition, Instagram portrait format, model centered with headroom above",
  },
  "9:16": {
    aspect: "9:16",
    width: 2160,
    height: 3840,
    tolerance: 0.005,
    promptDirective: "STRICT TALL PORTRAIT 9:16 FORMAT - exactly 2160x3840 pixels. Mobile/story vertical orientation.",
    compositionHint: "tall vertical composition, mobile story format, full-length framing with generous headroom",
  },
  "3:4": {
    aspect: "3:4",
    width: 2048,
    height: 2730,
    tolerance: 0.005,
    promptDirective: "STRICT PORTRAIT 3:4 FORMAT - exactly 2048x2730 pixels. Vertical orientation.",
    compositionHint: "vertical portrait composition, classic portrait framing, model centered with headroom",
  },
  "2:3": {
    aspect: "2:3",
    width: 2048,
    height: 3072,
    tolerance: 0.005,
    promptDirective: "STRICT PORTRAIT 2:3 FORMAT - exactly 2048x3072 pixels. Tall vertical orientation.",
    compositionHint: "tall portrait composition, classic photography ratio, full-length framing with generous headroom",
  },
  "5:4": {
    aspect: "5:4",
    width: 2560,
    height: 2048,
    tolerance: 0.005,
    promptDirective: "STRICT LANDSCAPE 5:4 FORMAT - exactly 2560x2048 pixels. Slight landscape orientation.",
    compositionHint: "slight landscape composition, model centered with balanced margins, room for context",
  },
  "4:3": {
    aspect: "4:3",
    width: 2730,
    height: 2048,
    tolerance: 0.005,
    promptDirective: "STRICT LANDSCAPE 4:3 FORMAT - exactly 2730x2048 pixels. Classic landscape orientation.",
    compositionHint: "classic landscape composition, model positioned with environmental context, balanced layout",
  },
  "3:2": {
    aspect: "3:2",
    width: 3072,
    height: 2048,
    tolerance: 0.005,
    promptDirective: "STRICT LANDSCAPE 3:2 FORMAT - exactly 3072x2048 pixels. Standard photo landscape.",
    compositionHint: "photography-standard landscape, model with environmental breathing room, editorial framing",
  },
  "16:9": {
    aspect: "16:9",
    width: 3840,
    height: 2160,
    tolerance: 0.005,
    promptDirective: "STRICT WIDESCREEN 16:9 FORMAT - exactly 3840x2160 pixels. Cinematic landscape.",
    compositionHint: "widescreen cinematic composition, hero banner framing, model positioned with wide environmental context",
  },
  "21:9": {
    aspect: "21:9",
    width: 5040,
    height: 2160,
    tolerance: 0.005,
    promptDirective: "STRICT ULTRA-WIDE 21:9 FORMAT - exactly 5040x2160 pixels. Panoramic orientation.",
    compositionHint: "ultra-wide panoramic composition, banner hero framing, model with expansive environmental context",
  },
};

const ALL_ASPECT_RATIOS = new Set(Object.keys(FORMAT_SPECS));

export function getFormatSpec(aspectRatio: string): FormatSpec {
  const spec = FORMAT_SPECS[aspectRatio];
  if (!spec) {
    console.error(`[FORMAT] Invalid aspect ratio "${aspectRatio}", falling back to 1:1`);
    return FORMAT_SPECS["1:1"];
  }
  return spec;
}

export function isValidAspectRatio(ratio: string): boolean {
  return ALL_ASPECT_RATIOS.has(ratio);
}

// ── Ethnicity & Skin Tone Descriptors ────────────────────────────────────────
export const ETHNICITY_DESCRIPTORS: Record<string, { male: string; female: string }> = {
  caucasian: { male: "Caucasian/European descent", female: "Caucasian/European descent" },
  black: { male: "Black/African descent", female: "Black/African descent" },
  "east-asian": {
    male: "East Asian descent (Chinese/Japanese/Korean)",
    female: "East Asian descent (Chinese/Japanese/Korean)",
  },
  "south-asian": {
    male: "South Asian descent (Indian/Pakistani/Bangladeshi)",
    female: "South Asian descent (Indian/Pakistani/Bangladeshi)",
  },
  "middle-eastern": { male: "Middle Eastern descent", female: "Middle Eastern descent" },
  latino: { male: "Latino/Hispanic descent", female: "Latina/Hispanic descent" },
  mixed: { male: "Mixed ethnicity with blended features", female: "Mixed ethnicity with blended features" },
};

export const SKIN_TONE_DESCRIPTORS: Record<string, string> = {
  fair: "fair/porcelain skin tone",
  light: "light skin tone",
  medium: "medium/olive skin tone",
  tan: "tan/bronze skin tone",
  deep: "deep/dark brown skin tone",
};

// ── Absolute Rules (injected into every prompt) ─────────────────────────────
export const ABSOLUTE_RULES = `
[ABSOLUTE RULES - ZERO EXCEPTIONS]
1. ZERO TEXT in image - no letters, numbers, hex codes, watermarks, labels, captions, annotations
2. FACE 100% VISIBLE - full head with forehead/eyes/nose/mouth/chin, 10% headroom, never crop/erase/obscure. Back view: back of head fully visible
3. SAME MODEL (MODELLOCK) - identical face/hair/age/skin/body from anchor across all outputs. Gender locked to user selection
4. SINGLE OUTPUT - one image, one person, one view, one pose. No grids, collages, split frames, borders, extra bodies
5. CORRECT BACKGROUND - studio cyclorama with visible floor for studio views; real photoreal street for outdoor. ALWAYS use the specified environment — NEVER reproduce the reference image's background, setting, or surfaces
6. POSE MATCHES VIEW - front=facing camera, side=90deg profile, back=facing away. Execute precisely
7. PRODUCTLOCK - garment design frozen (neckline, zipper, pockets, pattern, fit, seams). Only color changes for variants
8. NO NUDITY - always fully clothed. Female models: skinny jeans, leggings, or skirt as complementary bottom — NEVER men's trousers or chinos. Male models: chinos or tailored trousers. Always match complementary garments to the model's gender
9. NO REFERENCE LEAKAGE - ignore jewelry/watches/shoes/pose from product image. Generic neutral footwear only
10. PRESERVE IMPERFECTIONS - keep rips, fading, splatters, raw hems, stone wash, logos/graphics from original
11. NO COLOR BLEED - the product's color must NEVER contaminate complementary garments, skin, hair, or background. Each element retains its own independent color. Reference image background/lighting must not influence the generated scene
12. ARMS & HANDS COMPLETE - both arms fully visible from shoulder to fingertips, natural position, no missing/merged/amputated limbs, no arms hidden behind body (except back view)
13. FOOTWEAR LOCK (non-shoe products) — the SAME shoe style and color must appear on ALL views (front, back, side, outdoor). Once a shoe type is selected it cannot change between views. Identical style, identical color across every generated image
`;

export const NEGATIVE_PROMPT = `No text, no letters, no numbers, no hex codes, no labels, no watermarks, no collage, no multi-panel, no split screen, no extra people, no cropped heads, no cropped faces, no face erasure, no partial faces, no partial bodies, no identity swap, no grid layout, no design change, no obscured face, no nudity, no shirtless, no missing pants, no jewelry from reference, no watches from reference, no copied shoes, no copied pose, no logos from reference, no cleaning of product defects, no standing straight with hands by sides, no static neutral poses, no passport photos, no visible studio lights, no softboxes, no light stands, no reflectors, no lighting equipment, no studio rigging, no product color bleeding into other garments, no color contamination from reference image background, no color halos or tints from product onto model clothing or background, no background from reference image, no brick walls from reference, no reference environment reproduction, no reference image setting or surfaces, no missing arms, no amputated limbs, no merged arms, no hidden hands, no incomplete arms.`;

export const HOME_DECOR_NEGATIVE_PROMPT = `No text, no letters, no numbers, no watermarks, no labels, no logos, no annotations, no captions, no extra products, no product redesign, no color shift from original, no proportion change, no floating objects, no unnatural shadows, no CGI look, no 3D-render aesthetic, no plastic textures, no AI glow, no haze, no perfectly uniform surfaces, no collage, no multi-panel, no split screen, no grid layout.`;

// ── Input Validation Schemas ─────────────────────────────────────────────────
const validBaseViews = ["front", "side", "back", "outdoor"] as const;
const validPerspectives = ["fullProduct", "lifestylePrimary", "lifestyleSecondary"] as const;
const validAspectRatios = ["1:1", "4:5", "9:16", "16:9", "4:3", "3:4", "2:3", "3:2", "5:4", "21:9"] as const;
const validPlacements = [
  "bedside-table",
  "living-room-side-table",
  "dining-table",
  "coffee-table",
  "shelf",
  "console-table",
  "bathroom-shelf",
  "sideboard",
  "near-window",
  "above-sofa",
  "entry-console",
] as const;

const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

const FashionViewSchema = z.union([
  z.enum(validBaseViews),
  z.object({
    id: z.string(),
    name: z.string().optional(),
    pose: z.string().optional(),
    customPrompt: z.string().optional(),
  }),
]);

const ColorVariantSchema = z.object({
  color: z.string(),
  name: z.string(),
  id: z.string().optional(),
});

const ProductImageSchema = z
  .string()
  .min(1, "Product image is required")
  .refine(
    (val) => val.startsWith("data:image/") && val.includes(";base64,"),
    "Invalid image format - must be base64 encoded image",
  )
  .refine((val) => val.length < 15 * 1024 * 1024, "Image too large - maximum 10MB");

export const GenerateRequestSchema = z.object({
  action: z.enum(["start", "work", "reconcile"]).optional().default("start"),
  batchSize: z.number().int().min(1).max(500).optional().default(200),

  niche: z.enum(["fashion", "homeDecor"]).optional(),
  productImage: ProductImageSchema.optional(),

  views: z.array(FashionViewSchema).optional(),
  backgroundColor: z.string().regex(hexColorRegex, "Invalid hex color format").optional(),
  city: z.string().max(100, "City name too long").optional(),
  perspectives: z.array(z.enum(validPerspectives)).optional(),
  modelAge: z.number().int().min(18).max(70).optional(),
  aspectRatio: z.enum(validAspectRatios).optional(),
  primaryPlacement: z.enum(validPlacements).optional(),
  secondaryPlacement: z.enum(validPlacements).optional(),
  colorVariants: z.array(ColorVariantSchema).optional(),
  gender: z.enum(["male", "female"]).optional(),
  ethnicity: z
    .enum(["caucasian", "black", "east-asian", "south-asian", "middle-eastern", "latino", "mixed"])
    .optional(),
  skinTone: z.enum(["fair", "light", "medium", "tan", "deep"]).optional(),
  productType: z.enum(["top", "bottom", "shoes", "outfit"]).optional(),
  viewPose: z.enum(["full-body", "product-focused"]).optional(),
  season: z.enum(["summer", "winter", "fall", "spring"]).optional().default("summer"),
  jobId: z.string().uuid().optional(),
  resolution: z.enum(["1K", "2K"]).optional().default("1K"),
});

// ── Garment region helpers ───────────────────────────────────────────────────
export function getTargetMasks(productType: ProductType): GarmentMasks {
  switch (productType) {
    case "top":
      return { topMask: true, bottomMask: false, shoesMask: false, dressMask: false, accessoryMask: false };
    case "bottom":
      return { topMask: false, bottomMask: true, shoesMask: false, dressMask: false, accessoryMask: false };
    case "shoes":
      return { topMask: false, bottomMask: false, shoesMask: true, dressMask: false, accessoryMask: false };
    case "outfit":
      return { topMask: true, bottomMask: true, shoesMask: false, dressMask: true, accessoryMask: false };
  }
}

export function getFrozenGarments(productType: ProductType): string[] {
  switch (productType) {
    case "top":
      return ["pants/trousers", "shoes", "belt", "jacket in hand", "bag", "accessories", "undershirt/inner layer/crop top/t-shirt underneath"];
    case "bottom":
      return ["top/shirt/sweater", "shoes", "belt", "jacket in hand", "bag", "accessories", "undershirt/inner layer/crop top", "jacket/blazer/outerwear", "socks/tights/stockings"];
    case "shoes":
      return ["top/shirt/sweater", "pants/trousers", "belt", "bag", "accessories", "socks/tights/stockings", "jacket/blazer/outerwear", "undershirt/inner layer/crop top"];
    case "outfit":
      return ["shoes", "belt", "bag", "accessories", "jacket in hand", "undershirt/inner layer/crop top/t-shirt underneath", "socks/tights/stockings"];
  }
}

export function getTargetDescription(productType: ProductType): string {
  switch (productType) {
    case "top":
      return "the top/shirt/sweater/jacket ONLY";
    case "bottom":
      return "the pants/trousers/skirt/shorts ONLY";
    case "shoes":
      return "the shoes/footwear ONLY";
    case "outfit":
      return "the main outfit (top AND bottom together, OR the dress) ONLY - NOT shoes";
  }
}

export function normalizeView(
  view: string | { id: string; name?: string; pose?: string; customPrompt?: string },
): NormalizedView {
  if (typeof view === "string") return { id: view, name: view };
  return { id: view.id, name: view.name || view.id, pose: view.pose, customPrompt: view.customPrompt };
}

export function filterDisallowedViews(
  views: Array<string | { id: string; name?: string; pose?: string; customPrompt?: string }>,
): Array<string | { id: string; name?: string; pose?: string; customPrompt?: string }> {
  return views.filter((view) => {
    const normalized = normalizeView(view);
    const idLower = normalized.id.toLowerCase();
    const nameLower = (normalized.name || "").toLowerCase();
    if (idLower === "product-closeup" || nameLower === "product closeup") {
      console.log(`[FILTER] Skipping deprecated view: ${normalized.name || normalized.id}`);
      return false;
    }
    return true;
  });
}
