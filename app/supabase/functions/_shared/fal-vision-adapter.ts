/**
 * fal.ai vision adapter for image understanding (product extraction, validation).
 * Uses Bagel understand for single-image analysis.
 */

const BAGEL_UNDERSTAND = "fal-ai/bagel/understand";

function getFalKey(): string {
  const key = Deno.env.get("FAL_KEY");
  if (!key) {
    throw new Error("FAL_KEY is not configured");
  }
  return key;
}

export interface FalUnderstandResult {
  ok: true;
  text: string;
}

export interface FalUnderstandError {
  ok: false;
  error: string;
}

export type FalUnderstandResponse = FalUnderstandResult | FalUnderstandError;

/**
 * Analyze a single image with a text prompt. Returns the model's text response.
 * Used for: product blueprint extraction, layout validation, quality gate.
 */
export async function falUnderstandImage(
  imageUrl: string,
  prompt: string,
  timeoutMs = 30_000
): Promise<FalUnderstandResponse> {
  const key = getFalKey();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`https://queue.fal.run/${BAGEL_UNDERSTAND}`, {
      method: "POST",
      headers: {
        "Authorization": `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: imageUrl,
        prompt,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`FAL API error ${response.status}: ${errText}`);
    }

    const result = await response.json();
    const text = result?.text ?? result?.output ?? "";
    return { ok: true, text };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("aborted")) {
      console.error("[FAL-VISION] Timed out after", timeoutMs, "ms");
      return { ok: false, error: "Vision analysis timed out" };
    }
    console.error("[FAL-VISION] Error:", msg);
    return { ok: false, error: msg };
  }
}
