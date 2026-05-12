/**
 * Image generation adapter using fal.ai API.
 *
 * Text-to-image:  POST https://fal.run/fal-ai/nano-banana-2
 * Image editing:  POST https://fal.run/fal-ai/nano-banana/edit
 *
 * Auth: Authorization: Key <FAL_KEY>
 */

const T2I_ENDPOINT = "https://fal.run/fal-ai/nano-banana-2";
const EDIT_ENDPOINT = "https://fal.run/fal-ai/nano-banana/edit";

const MAX_RETRIES = 5;
const RETRY_DELAYS = [2000, 5000, 15000, 30000, 60000];
const REQUEST_TIMEOUT_MS = 60_000;

// HD calls: exactly 1 attempt — the durable task queue handles requeuing
const HD_MAX_RETRIES = 1;
const HD_RETRY_DELAYS: number[] = [];
const HD_REQUEST_TIMEOUT_MS = 120_000;

export type FalAspectRatio =
  | "auto"
  | "1:1"
  | "4:5"
  | "9:16"
  | "16:9"
  | "4:3"
  | "3:4"
  | "2:3"
  | "3:2"
  | "5:4"
  | "21:9";

export type FalResolution = "0.5K" | "1K" | "2K" | "4K";

export interface FalGenerateResult {
  ok: true;
  imageUrl: string;
}

export interface FalErrorResult {
  ok: false;
  retryable: boolean;
  error: string;
  status?: number;
}

export type FalResult = FalGenerateResult | FalErrorResult;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getFalKey(): string {
  const key = Deno.env.get("FAL_KEY");
  if (!key) throw new Error("FAL_KEY is not configured");
  return key;
}

// Map our resolution enum to fal.ai resolution param (only supported on nano-banana-2 t2i)
function toFalResolution(resolution?: FalResolution): string {
  switch (resolution) {
    case "2K": return "2K";
    case "4K": return "4K";
    case "0.5K": return "0.5K";
    case "1K":
    default: return "1K";
  }
}

// Map our aspect ratio to fal.ai aspect_ratio param
function toFalAspectRatio(aspectRatio?: FalAspectRatio): string {
  if (!aspectRatio || aspectRatio === "auto") return "auto";
  // fal.ai accepts the same string values we use
  return aspectRatio;
}

// ── Health check ─────────────────────────────────────────────────────────────
export async function checkProviderHealth(): Promise<{
  ok: boolean;
  project: string;
  region: string;
  model: string;
  error?: string;
}> {
  const base = { project: "fal.ai", region: "global", model: "nano-banana-2" };
  try {
    const key = getFalKey();
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(T2I_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${key}`,
      },
      body: JSON.stringify({
        prompt: "a plain white square, health check",
        aspect_ratio: "1:1",
        resolution: "0.5K",
        num_images: 1,
        limit_generations: true,
        safety_tolerance: "6",
      }),
      signal: controller.signal,
    });

    clearTimeout(t);

    if (!res.ok) {
      const text = await res.text();
      return { ...base, ok: false, error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
    }

    await res.json();
    return { ...base, ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...base, ok: false, error: msg };
  }
}

// ── Main generation function ──────────────────────────────────────────────────
export async function falGenerateImage(
  prompt: string,
  imageUrls: string[],
  options: {
    aspectRatio?: FalAspectRatio;
    resolution?: FalResolution;
    model?: string; // ignored — endpoint is selected by isEdit
    maxRetries?: number;
    retryDelays?: number[];
    timeoutMs?: number;
  } = {}
): Promise<FalResult> {
  const key = getFalKey();
  const isEdit = imageUrls.length > 0;
  const endpoint = isEdit ? EDIT_ENDPOINT : T2I_ENDPOINT;
  const aspectRatio = toFalAspectRatio(options.aspectRatio);

  const isHeavy = options.resolution === "2K" || options.resolution === "4K";
  const maxRetries = options.maxRetries ?? (isHeavy ? HD_MAX_RETRIES : MAX_RETRIES);
  const retryDelays = options.retryDelays ?? (isHeavy ? HD_RETRY_DELAYS : RETRY_DELAYS);
  const requestTimeout = options.timeoutMs ?? (isHeavy ? HD_REQUEST_TIMEOUT_MS : REQUEST_TIMEOUT_MS);

  // Build request body — edit endpoint takes image_urls, t2i takes resolution
  const body: Record<string, unknown> = {
    prompt,
    num_images: 1,
    aspect_ratio: aspectRatio,
    output_format: "png",
    safety_tolerance: "6",
    limit_generations: true,
  };

  if (isEdit) {
    // nano-banana/edit accepts public URLs directly
    body.image_urls = imageUrls;
  } else {
    // resolution param is only available on nano-banana-2 (t2i)
    body.resolution = toFalResolution(options.resolution);
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.info(
        `[FAL] Attempt ${attempt + 1}/${maxRetries} endpoint=${isEdit ? "edit" : "t2i"} ` +
        `aspectRatio=${aspectRatio} resolution=${options.resolution ?? "1K"} imageCount=${imageUrls.length}`
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${key}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        const status = res.status;

        if (status === 429) {
          const retryAfterHeader = res.headers.get("Retry-After");
          const parsedSeconds = parseInt(retryAfterHeader ?? "", 10);
          const retryAfterMs =
            retryAfterHeader && Number.isFinite(parsedSeconds) && parsedSeconds > 0
              ? Math.min(parsedSeconds * 1000, 120_000)
              : retryDelays[attempt] ?? 60_000;
          console.warn(
            `[FAL] 429 rate limited on attempt ${attempt + 1}/${maxRetries}. ` +
            `Waiting ${retryAfterMs}ms. Detail: ${text.slice(0, 200)}`
          );
          if (attempt < maxRetries - 1) {
            await sleep(retryAfterMs);
            continue;
          }
          return { ok: false, retryable: true, error: `RATE_LIMITED: ${text.slice(0, 200)}`, status };
        }

        if (status === 401 || status === 403) {
          console.error(`[FAL] Auth error ${status}: ${text.slice(0, 300)}`);
          return { ok: false, retryable: false, error: `Auth failed (${status}): ${text.slice(0, 200)}`, status };
        }

        if (status === 402) {
          console.error(`[FAL] Credits exhausted (402)`);
          return { ok: false, retryable: false, error: "FAL credits exhausted", status };
        }

        if (status === 400 && (text.includes("SAFETY") || text.includes("blocked") || text.includes("safety"))) {
          return { ok: false, retryable: true, error: "SAFETY_BLOCKED", status };
        }

        console.error(`[FAL] HTTP error ${status}: ${text.slice(0, 500)}`);

        const retryable = status >= 500;
        if (retryable && attempt < maxRetries - 1) {
          await sleep(retryDelays[attempt] || 4000);
          continue;
        }

        return { ok: false, retryable, error: `HTTP ${status}: ${text.slice(0, 200)}`, status };
      }

      const json = await res.json();

      // fal.ai response: { images: [{ url, content_type, file_name }], description }
      const images = json.images;
      if (Array.isArray(images) && images.length > 0 && images[0]?.url) {
        console.info(`[FAL] Success on attempt ${attempt + 1} — url=${images[0].url.slice(0, 80)}...`);
        return { ok: true, imageUrl: images[0].url };
      }

      console.warn(
        `[FAL] No image in response on attempt ${attempt + 1}/${maxRetries}. ` +
        `Response keys: ${Object.keys(json).join(", ")}`
      );

      if (attempt < maxRetries - 1) {
        await sleep(retryDelays[attempt] || 4000);
        continue;
      }

      return { ok: false, retryable: true, error: "No image in response after all retries" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes("aborted") || msg.includes("abort")) {
        console.error(`[FAL] Request timed out (${requestTimeout / 1000}s)`);
        if (attempt < maxRetries - 1) {
          await sleep(retryDelays[attempt] || 4000);
          continue;
        }
        return { ok: false, retryable: true, error: `Request timed out after ${requestTimeout / 1000}s` };
      }

      const retryable = /(timeout|network|fetch|ECONNREFUSED)/i.test(msg);
      console.error(`[FAL] Error:`, msg);

      if (retryable && attempt < maxRetries - 1) {
        await sleep(retryDelays[attempt] || 4000);
        continue;
      }

      return { ok: false, retryable, error: msg };
    }
  }

  return { ok: false, retryable: false, error: "All retries exhausted" };
}
