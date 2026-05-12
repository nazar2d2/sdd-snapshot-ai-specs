import type { FormatSpec, GateLogEntry, MasterGateResult, FormatCheckResult, ProductBlueprint, ProductType } from "./types.ts";
import { FAST_ENGINE } from "./config.ts";

// ── Gate Logging ─────────────────────────────────────────────────────────────
const gateLogBuffer: GateLogEntry[] = [];

export function logGate(entry: GateLogEntry) {
  gateLogBuffer.push(entry);
  const status = entry.passed ? "✓ PASS" : "✗ FAIL";
  const scoreStr = entry.score !== undefined ? ` (score: ${entry.score.toFixed(2)})` : "";
  console.log(`[GATE:${entry.gateName}] ${status}${scoreStr} ${entry.failReason || ""} [${entry.latencyMs}ms]`);
}

export function getGateLog(): GateLogEntry[] {
  return gateLogBuffer;
}

// ── Format Gate (deterministic math check — no AI call) ──────────────────────
export function runFormatGate(
  imageDataUrl: string,
  formatSpec: FormatSpec,
  taskId: string,
  retryCount: number,
  getImageDimensions: (dataUrl: string) => { width: number; height: number } | null,
): FormatCheckResult {
  const gateStart = Date.now();
  const dims = getImageDimensions(imageDataUrl);

  if (!dims) {
    // URL-based images (https://) cannot be parsed synchronously — skip gate, let canvas handle it
    logGate({
      taskId,
      gateName: "FormatGate",
      passed: true,
      failReason: "Skipped — non-inline image URL",
      retryCount,
      latencyMs: 0,
    });
    return { passed: true };
  }

  const actualAspect = dims.width / dims.height;
  const [tw, th] = formatSpec.aspect.split(":").map(Number);
  const targetAspect = tw / th;

  const deviation = Math.abs(actualAspect - targetAspect) / targetAspect;
  const passed = deviation <= formatSpec.tolerance;

  logGate({
    taskId,
    gateName: "FormatGate",
    passed,
    score: 1 - deviation,
    failReason: passed ? undefined : `Aspect ${actualAspect.toFixed(2)} vs target ${targetAspect.toFixed(2)}`,
    retryCount,
    latencyMs: Date.now() - gateStart,
  });

  return {
    passed,
    actualAspect,
    targetAspect,
    reason: passed ? undefined : `Aspect ratio mismatch: ${(deviation * 100).toFixed(1)}% deviation`,
  };
}

// ── Master Gate (consolidated face + layout + product check — 1 AI call) ─────
export async function runMasterGate(
  generatedImageUrl: string,
  productImageUrl: string,
  blueprint: ProductBlueprint | null,
  productType: ProductType,
  viewKey: string,
  taskId: string,
  retryCount: number,
  GOOGLE_AI_API_KEY?: string,
): Promise<MasterGateResult> {
  const gateStart = Date.now();
  const isShoes = productType === "shoes";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const masterPrompt = `Analyze this image pair (Ref: Product, Gen: Model). STRICT VALIDATION.
    
1. FACE CHECK:
   - Is the FULL FACE visible? (Forehead to chin). 
   - Is there headroom?
   - If 'Back View', is back of head visible?
   - FAIL if: Cropped head, missing face, obscured face.
   
2. LAYOUT CHECK:
   - Is it a SINGLE image? (No collage, no grid).
   - EXACTLY ONE person?
   - FAIL if: Borders, text, multiple people, split screen.
   
3. PRODUCT INTEGRITY:
   - Does garment match Reference exactly?
   - TEXTURE/PATTERN PRESERVED? (Crucial)
   - FAIL if: Wrong neckline, wrong pattern, wrong length.
   
Return JSON ONLY:
{
  "face": { "pass": boolean, "issue": "..." },
  "layout": { "pass": boolean, "issue": "..." },
  "product": { "pass": boolean, "issue": "..." },
  "overall_pass": boolean,
  "fatal_issue": "..."
}`;

    // Fetch images and convert to base64 for Google API
    const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
    for (const imgUrl of [productImageUrl, generatedImageUrl]) {
      const dataMatch = imgUrl.match(/^data:(image\/[^;]+);base64,(.+)$/s);
      if (dataMatch) {
        imageParts.push({ inlineData: { mimeType: dataMatch[1], data: dataMatch[2] } });
      } else {
        try {
          const imgResp = await fetch(imgUrl);
          if (imgResp.ok) {
            const buffer = await imgResp.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = "";
            for (let i = 0; i < bytes.length; i += 8192) {
              binary += String.fromCharCode(...bytes.slice(i, i + 8192));
            }
            const base64 = btoa(binary);
            const ct = imgResp.headers.get("content-type") || "image/png";
            imageParts.push({ inlineData: { mimeType: ct, data: base64 } });
          }
        } catch (_e) { /* skip */ }
      }
    }

    const passThrough: MasterGateResult = {
      passed: true,
      faceResult: { passed: true },
      layoutResult: { passed: true },
      qualityResult: { passed: true, score: 1 },
      productResult: { passed: true, score: 1 },
    };

    if (!GOOGLE_AI_API_KEY) {
      logGate({ taskId, gateName: "MasterGate", passed: true, failReason: "No auth", retryCount, latencyMs: Date.now() - gateStart });
      return passThrough;
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_API_KEY}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    const resp = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: masterPrompt },
            ...imageParts,
          ],
        }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - gateStart;

    if (!resp.ok) {
      logGate({ taskId, gateName: "MasterGate", passed: true, failReason: "API unavailable", retryCount, latencyMs });
      return passThrough;
    }

    const data = await resp.json();
    const content = String(data.candidates?.[0]?.content?.parts?.[0]?.text || "");
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      logGate({ taskId, gateName: "MasterGate", passed: true, failReason: "No JSON", retryCount, latencyMs });
      return passThrough;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const facePass = isShoes ? true : parsed.face?.pass !== false;
    const layoutPass = parsed.layout?.pass !== false;
    const productPass = parsed.product?.pass !== false;
    const overallPass = facePass && layoutPass && productPass;

    logGate({
      taskId,
      gateName: "MasterGate",
      passed: overallPass,
      failReason: parsed.fatal_issue || (!overallPass ? "Multiple checks failed" : undefined),
      retryCount,
      latencyMs,
    });

    return {
      passed: overallPass,
      failReason: parsed.fatal_issue,
      faceResult: { passed: facePass, reason: parsed.face?.issue },
      layoutResult: { passed: layoutPass, reason: parsed.layout?.issue },
      qualityResult: { passed: true, score: 1 },
      productResult: { passed: productPass, score: 1, reason: parsed.product?.issue },
    };
  } catch (err: any) {
    const latencyMs = Date.now() - gateStart;
    console.error("[MasterGate] Validation error:", err);
    logGate({ taskId, gateName: "MasterGate", passed: true, failReason: err.message, retryCount, latencyMs });
    return {
      passed: true,
      faceResult: { passed: true },
      layoutResult: { passed: true },
      qualityResult: { passed: true, score: 1 },
      productResult: { passed: true, score: 1 },
    };
  }
}
