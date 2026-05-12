import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { createFullBleedCanvas } from "./canvas-helper.ts";
import { falGenerateImage, checkProviderHealth } from "../_shared/fal-adapter.ts";

import type { ModelProfile, ProductBlueprint, ProductType, ViewPose, IdentityAnchor } from "./types.ts";
import {
  ENGINE,
  HD_ENGINE,
  SPEED_SLA,
  RATE_LIMIT_CONFIG,
  MAX_IMAGES_PER_JOB,
  GenerateRequestSchema,
  getFormatSpec,
  isValidAspectRatio,
  getFrozenGarments,
  normalizeView,
  filterDisallowedViews,
} from "./config.ts";
import { createModelProfile, deriveTaskSeed } from "./model-lock.ts";
import { extractProductBlueprint } from "./blueprint.ts";
import { buildAnchorPrompt } from "./anchor.ts";
import { buildFashionPrompt, buildStrictColorEditPrompt, homeDecorPrompts, enforcePromptBudget } from "./prompts.ts";
import { logGate, runFormatGate } from "./gates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Image dimension reader (works on base64 data URLs) ───────────────────────
function getImageDimensions(dataUrl: string): { width: number; height: number } | null {
  try {
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
    if (!match) return null;

    const contentType = match[1];
    const base64 = match[2];
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    if (contentType.includes("png")) {
      if (bytes.length < 24) return null;
      const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
      return { width, height };
    } else if (contentType.includes("jpeg") || contentType.includes("jpg")) {
      let i = 2;
      while (i < bytes.length - 8) {
        if (bytes[i] === 0xff) {
          const marker = bytes[i + 1];
          if (marker === 0xc0 || marker === 0xc2) {
            const height = (bytes[i + 5] << 8) | bytes[i + 6];
            const width = (bytes[i + 7] << 8) | bytes[i + 8];
            return { width, height };
          }
          const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
          i += 2 + segLen;
        } else {
          i++;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ── Product hash (SHA-256) ───────────────────────────────────────────────────
async function computeProductHash(imageDataUrl: string): Promise<string> {
  const match = imageDataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL for hashing");
  const base64 = match[1];
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

// ── Request-scoped rate limiter ──────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class RequestScopedRateLimiter {
  private lastProviderCallTime = 0;
  private isThrottled = false;
  private throttleUntil = 0;
  private _maxInflight: number;
  private startQueue: Promise<void> = Promise.resolve();

  constructor() {
    this._maxInflight = SPEED_SLA.workerPoolSize;
  }

  get maxInflight(): number {
    return this._maxInflight;
  }

  async waitForRateLimit(): Promise<void> {
    this.startQueue = this.startQueue.then(async () => {
      const now = Date.now();
      if (this.isThrottled && now > this.throttleUntil) {
        this.isThrottled = false;
        this._maxInflight = SPEED_SLA.workerPoolSize;
        console.log("[RATE] Throttle lifted");
      }
      const spacing = this.isThrottled ? RATE_LIMIT_CONFIG.throttledSpacingMs : RATE_LIMIT_CONFIG.providerSpacingMs;
      const elapsed = now - this.lastProviderCallTime;
      const waitTime = Math.max(0, spacing - elapsed);
      if (waitTime > 0) await sleep(waitTime);
      this.lastProviderCallTime = Date.now();
    });
    await this.startQueue;
  }

  activateThrottle() {
    if (!this.isThrottled) {
      console.log("[RATE] Activating throttle");
      this.isThrottled = true;
      this.throttleUntil = Date.now() + RATE_LIMIT_CONFIG.throttleDurationMs;
      this._maxInflight = 2;
    }
  }
}

let requestRateLimiter: RequestScopedRateLimiter | null = null;

async function waitForRateLimit(): Promise<void> {
  if (!requestRateLimiter) requestRateLimiter = new RequestScopedRateLimiter();
  return requestRateLimiter.waitForRateLimit();
}

function activateThrottle(): void {
  if (!requestRateLimiter) requestRateLimiter = new RequestScopedRateLimiter();
  requestRateLimiter.activateThrottle();
}

// ── Placement / slug helpers ─────────────────────────────────────────────────
function formatPlacement(placement: string): string {
  return placement.replace(/-/g, " ");
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN SERVER
// ══════════════════════════════════════════════════════════════════════════════
serve(async (req) => {
  requestRateLimiter = new RequestScopedRateLimiter();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Health check (requires HEALTH_CHECK_SECRET header) ─────────────
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "health") {
      const adminSecret = Deno.env.get("HEALTH_CHECK_SECRET");
      if (!adminSecret || req.headers.get("x-health-secret") !== adminSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await checkProviderHealth();
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch { /* fall through to normal flow */ }

  const JOB_START = Date.now();
  const MAX_JOB_TIME_MS = 230_000;

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : authHeader.trim();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error("[AUTH] Error:", userError);
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse & validate body ──────────────────────────────────────────────
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parseResult = GenerateRequestSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      console.error("[VALIDATE] Failed:", errorMessages);
      return new Response(JSON.stringify({ error: `Validation failed: ${errorMessages}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      action,
      niche,
      productImage,
      views: rawViews,
      backgroundColor,
      city,
      perspectives,
      modelAge,
      aspectRatio,
      primaryPlacement,
      secondaryPlacement,
      colorVariants,
      gender,
      ethnicity,
      skinTone,
      productType,
      viewPose,
      season,
      resolution,
      jobId: resumeJobId,
    } = parseResult.data;

    // ── Action pre-checks ──────────────────────────────────────────────────
    if (action === "work" || action === "reconcile") {
      if (!resumeJobId) {
        return new Response(JSON.stringify({ error: `jobId is required for action=${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      if (!niche) {
        return new Response(JSON.stringify({ error: "niche is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!productImage) {
        return new Response(JSON.stringify({ error: "productImage is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (niche === "fashion" && (!rawViews || rawViews.length === 0)) {
        return new Response(JSON.stringify({ error: "Please select at least one view" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (niche === "homeDecor" && (!perspectives || perspectives.length === 0)) {
        return new Response(JSON.stringify({ error: "Please select at least one perspective" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const views = rawViews ? filterDisallowedViews(rawViews) : [];
    const aspectRatioText = aspectRatio || "1:1";
    const aspectRatioPrompt = `Output a full-bleed ${aspectRatioText} image.`;

    // ── Service clients ────────────────────────────────────────────────────
    const STORAGE_BUCKET = "generated-images";
    // GOOGLE_AI_API_KEY is optional — blueprint/gates now use Vertex service account auth
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const adminClient = SUPABASE_SERVICE_ROLE_KEY
      ? createClient(supabaseUrl, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
      : null;

    const RUN_ID = crypto.randomUUID();

    // ── Storage helpers ────────────────────────────────────────────────────
    const ensureBucket = async () => {
      if (!adminClient) return;
      const { data: buckets } = await adminClient.storage.listBuckets();
      const exists = buckets?.some((b: any) => b.name === STORAGE_BUCKET);
      if (!exists) {
        await adminClient.storage.createBucket(STORAGE_BUCKET, { public: false });
        console.log(`[STORAGE] Created bucket: ${STORAGE_BUCKET}`);
      }
    };

    const slugify = (s: string) =>
      s
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-()]/g, "")
        .slice(0, 80);

    const dataUrlToBytes = (dataUrl: string): { bytes: Uint8Array; contentType: string; ext: string } => {
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) throw new Error("Invalid image data URL");
      const contentType = match[1];
      const base64 = match[2];
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const ext = contentType.includes("png") ? "png" : contentType.includes("jpeg") ? "jpg" : "png";
      return { bytes, contentType, ext };
    };

    const fetchUrlToBytes = async (url: string): Promise<{ bytes: Uint8Array; contentType: string; ext: string }> => {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
      const contentType = resp.headers.get("content-type") || "image/png";
      const buffer = await resp.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
      return { bytes, contentType, ext };
    };

    const resolveImageToBytes = async (imageUrl: string): Promise<{ bytes: Uint8Array; contentType: string; ext: string }> => {
      if (imageUrl.startsWith("data:")) return dataUrlToBytes(imageUrl);
      return fetchUrlToBytes(imageUrl);
    };

    const uploadAndSign = async (
      userId: string,
      view: string,
      imageUrl: string,
      jobId?: string,
      viewKey?: string,
      variantKey?: string,
    ): Promise<string> => {
      if (!adminClient) return imageUrl;
      const { bytes, contentType, ext } = await resolveImageToBytes(imageUrl);
      const path =
        jobId && viewKey && variantKey
          ? `jobs/${jobId}/${slugify(viewKey)}/${slugify(variantKey)}.${ext}`
          : `${userId}/${RUN_ID}/${slugify(view)}.${ext}`;

      const { error: uploadError } = await adminClient.storage
        .from(STORAGE_BUCKET)
        .upload(path, bytes, { contentType, upsert: true });
      if (uploadError) {
        console.error("[UPLOAD] Error:", uploadError);
        return imageUrl;
      }

      const { data, error: signError } = await adminClient.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(path, 60 * 60 * 24);
      if (signError || !data?.signedUrl) {
        console.error("[SIGN] Error:", signError);
        return imageUrl;
      }
      return data.signedUrl;
    };

    const uploadAndSignAtPath = async (path: string, imageUrl: string, expiresSec = 60 * 60 * 24): Promise<string> => {
      if (!adminClient) return imageUrl;
      const { bytes, contentType } = await resolveImageToBytes(imageUrl);
      const { error: uploadError } = await adminClient.storage
        .from(STORAGE_BUCKET)
        .upload(path, bytes, { contentType, upsert: true });
      if (uploadError) {
        console.error("[UPLOAD] Error:", uploadError);
        return imageUrl;
      }
      const { data, error: signError } = await adminClient.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(path, expiresSec);
      if (signError || !data?.signedUrl) {
        console.error("[SIGN] Error:", signError);
        return imageUrl;
      }
      return data.signedUrl;
    };

    const trySignExisting = async (path: string, expiresSec = 60 * 60 * 24): Promise<string | null> => {
      if (!adminClient) return null;
      const { data, error } = await adminClient.storage.from(STORAGE_BUCKET).createSignedUrl(path, expiresSec);
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    };

    // IMG-01/02: Store storage path instead of signed URL.
    // Callers that feed result into updateTaskResult use this function.
    const uploadAndGetPath = async (
      userId: string,
      view: string,
      imageUrl: string,
      jobId?: string,
      viewKey?: string,
      variantKey?: string,
    ): Promise<string> => {
      if (!adminClient) return imageUrl;
      const { bytes, contentType, ext } = await resolveImageToBytes(imageUrl);
      const path =
        jobId && viewKey && variantKey
          ? `jobs/${jobId}/${slugify(viewKey)}/${slugify(variantKey)}.${ext}`
          : `${userId}/${RUN_ID}/${slugify(view)}.${ext}`;

      const { error: uploadError } = await adminClient.storage
        .from(STORAGE_BUCKET)
        .upload(path, bytes, { contentType, upsert: true });
      if (uploadError) {
        console.error("[UPLOAD] Error:", uploadError);
        // Fallback: return signed URL so the task is not lost entirely
        return imageUrl;
      }
      return path;
    };

    // IMG-03: Backward-compat helper — signs both storage paths and legacy signed URLs.
    // Use when reading result_url from DB to display to the client.
    // - "jobs/..." → sign directly
    // - "https://...token=..." (Supabase signed URL) → extract path, re-sign
    // - other https:// → return as-is (external URL, not our storage)
    const signStoragePathOrUrl = async (value: string, expiresSec = 60 * 60 * 24): Promise<string> => {
      if (!adminClient) return value;
      // Already a storage path
      if (!value.startsWith("https://")) {
        const signed = await trySignExisting(value, expiresSec);
        return signed ?? value;
      }
      // Legacy Supabase signed URL — extract the object path and re-sign
      if (value.includes("token=")) {
        try {
          const url = new URL(value);
          // Supabase signed URL path: /storage/v1/object/sign/{bucket}/{object-path}
          const match = url.pathname.match(/\/storage\/v1\/object\/sign\/[^/]+\/(.+)/);
          if (match) {
            const objectPath = decodeURIComponent(match[1]);
            const resigned = await trySignExisting(objectPath, expiresSec);
            if (resigned) return resigned;
          }
        } catch { /* fall through */ }
      }
      // External URL or unrecognised format — return as-is
      return value;
    };

    await ensureBucket();

    // Convert base64 data URLs to HTTP URLs (Poyo API requires HTTP URIs)
    const resolveToHttpUrl = async (imageUrl: string): Promise<string> => {
      if (!imageUrl.startsWith("data:image/")) return imageUrl;
      if (!adminClient) return imageUrl;
      const tempPath = `${user.id}/tmp/${crypto.randomUUID()}.png`;
      return await uploadAndSignAtPath(tempPath, imageUrl, 60 * 60); // 1h expiry
    };

    // ── Generation helpers ─────────────────────────────────────────────────
    const generateOnce = async (
      prompt: string,
      imageInputs: string[],
      useFastPreset: boolean = false,
      aspectRatio: string = "1:1",
      resolution: "1K" | "2K" | "4K" = "4K",
      model?: string,
    ): Promise<
      | { ok: true; imageUrl: string; timedOut?: boolean }
      | { ok: false; retryable: boolean; error: string; status?: number; timedOut?: boolean }
    > => {
      await waitForRateLimit();

      // Resolve all inputs to HTTP URLs for Poyo API compatibility
      let effectiveInputs = await Promise.all(imageInputs.map(resolveToHttpUrl));
      if (effectiveInputs.length === 1 && effectiveInputs[0].startsWith("http")) {
        console.log("[GEN] Pre-processing input to force 1:1 Full Bleed...");
        const bleedResult = await createFullBleedCanvas(imageInputs[0], 1024, 1024, "studio", "#F7F7F7");
        if (bleedResult.ok) {
          console.log("[GEN] Input successfully standardized to 1:1");
          const httpUrl = await resolveToHttpUrl(bleedResult.imageUrl);
          effectiveInputs = [httpUrl];
        } else {
          console.warn(`[GEN] Input standardization failed: ${bleedResult.error}. Proceeding with raw input.`);
        }
      } else {
        console.log("[GEN] Multiple inputs or non-http, skipping full-bleed pre-processing");
      }

      // Enforce prompt budget before sending to provider
      const budgetedPrompt = enforcePromptBudget(prompt);
      if (budgetedPrompt.length !== prompt.length) {
        console.log(`[GEN] Prompt trimmed: ${prompt.length} -> ${budgetedPrompt.length} chars`);
      }
      console.log(`[GEN] Prompt length: ${budgetedPrompt.length} chars`);

      // Use longer timeout for HD renders to avoid premature requeuing
      const isHdRender = resolution === "2K" || resolution === "4K";
      const timeout = useFastPreset ? 45_000 : (isHdRender ? SPEED_SLA.hdRenderTimeoutMs : SPEED_SLA.baseRenderTimeoutMs);
      const falPromise = falGenerateImage(budgetedPrompt, effectiveInputs, { aspectRatio, resolution, model });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout),
      );

      try {
        const result = await Promise.race([falPromise, timeoutPromise]);
        if (result.ok) return { ok: true, imageUrl: result.imageUrl };
        if (result.status === 429) activateThrottle();
        return { ok: false, retryable: result.retryable, status: result.status, error: result.error };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Request timed out")) {
          console.error(`[GEN] Request timed out (${timeout / 1000}s SLA breach)`);
          return { ok: false, retryable: true, error: "Request timed out", timedOut: true };
        }
        console.error("[GEN] Network error:", msg);
        return { ok: false, retryable: true, error: msg };
      }
    };

    const editOnceWithGuards = async (
      editPrompt: string,
      baseImageUrl: string,
      _productTypeVal: ProductType,
      _blueprint: ProductBlueprint | null,
      _retryCount: number = 0,
      aspectRatio: string = "1:1",
      resolution: "0.5K" | "1K" | "2K" | "4K" = "4K",
      model?: string,
    ): Promise<{ ok: true; imageUrl: string } | { ok: false; retryable: boolean; error: string; status?: number }> => {
      await waitForRateLimit();
      const falPromise = falGenerateImage(editPrompt, [baseImageUrl], { aspectRatio, resolution, model });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Edit request timed out")), SPEED_SLA.perImageTimeoutMs),
      );
      try {
        const result = await Promise.race([falPromise, timeoutPromise]);
        if (result.ok) return { ok: true, imageUrl: result.imageUrl };
        if (result.status === 429) activateThrottle();
        return { ok: false, retryable: result.retryable, status: result.status, error: result.error };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Edit request timed out")) {
          console.error("[EDIT] Request timed out (SLA breach)");
          return { ok: false, retryable: true, error: "Edit request timed out" };
        }
        console.error("[EDIT] Network error:", msg);
        return { ok: false, retryable: true, error: msg };
      }
    };

    // ── DB helpers ─────────────────────────────────────────────────────────
    const updateTaskResult = async (dbTaskId: string, imageUrl: string | null, error: string | null) => {
      if (!adminClient || !dbTaskId) return;
      if (imageUrl) {
        await adminClient
          .from("generation_tasks")
          .update({ status: "done", result_url: imageUrl, last_error: null, updated_at: new Date().toISOString() })
          .eq("id", dbTaskId);
      } else {
        await adminClient
          .from("generation_tasks")
          .update({ status: "failed", last_error: error, updated_at: new Date().toISOString() })
          .eq("id", dbTaskId)
          .eq("status", "running"); // never downgrade a done task
      }
    };

    const updateJobCounts = async (dbJobId: string) => {
      if (!adminClient) return;
      const safeCount = (c: number | null) => (typeof c === "number" ? c : 0);
      const [doneRes, failedRes, pendingRes] = await Promise.all([
        adminClient.from("generation_tasks").select("id", { count: "exact", head: true }).eq("job_id", dbJobId).eq("status", "done"),
        adminClient.from("generation_tasks").select("id", { count: "exact", head: true }).eq("job_id", dbJobId).eq("status", "failed"),
        adminClient.from("generation_tasks").select("id", { count: "exact", head: true }).eq("job_id", dbJobId).in("status", ["pending", "running"]),
      ]);
      const done = safeCount(doneRes.count);
      const failed = safeCount(failedRes.count);
      const pendingOrRunning = safeCount(pendingRes.count);

      const { data: jobData } = await adminClient.from("generation_jobs").select("tasks_total").eq("id", dbJobId).single();
      const expectedTotal = jobData?.tasks_total || done + failed + pendingOrRunning;

      let newStatus = "running";
      const allAccountedFor = done + failed + pendingOrRunning >= expectedTotal;
      if (done >= expectedTotal) {
        newStatus = "done";
      } else if (pendingOrRunning === 0 && failed > 0) {
        newStatus = "failed";
      } else if (pendingOrRunning === 0 && allAccountedFor && failed === 0) {
        newStatus = "done";
      }

      await adminClient
        .from("generation_jobs")
        .update({
          tasks_done: done,
          tasks_failed: failed,
          status: newStatus,
          updated_at: new Date().toISOString(),
          ...(newStatus === "done" ? { completed_at: new Date().toISOString() } : {}),
        })
        .eq("id", dbJobId);
    };

    const computeBackoffMs = (attempt: number, isHd: boolean = false) => {
      const schedule = isHd ? SPEED_SLA.hdBackoffMs : SPEED_SLA.backoffMs;
      const base = schedule[Math.min(attempt - 1, schedule.length - 1)] || 4000;
      const jitter = Math.random() * base * 0.2;
      return Math.round(base + jitter);
    };

    // isHdJob is derived from the DB job record (not from the request body which may be missing resolution)
    let _moveTaskIsHd = false;

    const moveTaskBackToPending = async (taskId: string, attempt: number, error: string) => {
      if (!adminClient) return;
      const isHd = _moveTaskIsHd;
      const delay = computeBackoffMs(attempt, isHd);
      console.log(`[REQUEUE] task=${taskId} attempt=${attempt} isHd=${isHd} delay=${delay}ms error=${error.slice(0, 120)}`);
      // Only reset if task is still "running" AND has no result — prevents downgrading succeeded tasks
      await adminClient
        .from("generation_tasks")
        .update({
          status: "pending",
          last_error: error,
          next_run_at: new Date(Date.now() + delay).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .eq("status", "running")
        .is("result_url", null);
    };

    const isFashion = niche === "fashion";

    // ════════════════════════════════════════════════════════════════════════
    // ACTION = "work"
    // ════════════════════════════════════════════════════════════════════════
    if (action === "work") {
      if (!adminClient) {
        return new Response(JSON.stringify({ error: "Server configuration error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const dbJobId = resumeJobId as string;
      const { data: job, error: jobErr } = await adminClient
        .from("generation_jobs")
        .select("id, user_id, status, niche, tasks_total, tasks_done, tasks_failed, model_lock, config, anchor_url, job_seed, product_hash")
        .eq("id", dbJobId)
        .maybeSingle();

      if (jobErr || !job) {
        return new Response(JSON.stringify({ error: "Job not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (job.user_id !== user.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const cfg = (job.config || {}) as Record<string, any>;
      const jobNiche = (job as any).niche as string;
      const jobResolution = (cfg.resolution as string) || "1K";
      const isHdJob = jobResolution === "2K";
      // CONFIG-01/02: Read model from job config snapshot — never re-derive from runtime state
      const jobModel = (cfg.model_engine as string) || (isHdJob ? HD_ENGINE : ENGINE);
      const hdCreditMultiplier = isHdJob ? 3 : 1;
      const effectiveMaxAttempts = isHdJob ? RATE_LIMIT_CONFIG.hdMaxAttempts : RATE_LIMIT_CONFIG.maxAttempts;

      // Set the resolution flag for moveTaskBackToPending (derived from DB, not request body)
      _moveTaskIsHd = isHdJob;

      console.log(`[WORK] resolution=${jobResolution} isHd=${isHdJob} model=${jobModel || ENGINE} maxAttempts=${effectiveMaxAttempts} hdRetries=disabled(1) providerTimeout=${isHdJob ? "120s" : "60s"}`);

      // ══════════════════════════════════════════════════════════════════
      // HOME DECOR work path
      // ══════════════════════════════════════════════════════════════════
      if (jobNiche === "homeDecor") {
        const signPath = async (path: string, expiresSec = 60 * 60 * 24) => {
          const { data, error } = await adminClient.storage.from(STORAGE_BUCKET).createSignedUrl(path, expiresSec);
          if (error || !data?.signedUrl) return null;
          return data.signedUrl;
        };

        const productPath = cfg.product_path as string | undefined;
        if (!productPath) {
          return new Response(JSON.stringify({ error: "Job is missing product image" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const productUrl = await signPath(productPath);
        if (!productUrl) {
          return new Response(JSON.stringify({ error: "Failed to sign product image" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const bgColor = (cfg.backgroundColor as string) || "#F7F7F7";
        const primary = (cfg.primaryPlacement as string) || "coffee-table";
        const secondary = (cfg.secondaryPlacement as string) || "shelf";

        // Stale task recovery — mirrors fashion path (STATE-01: never reset attempt_count)
        const STALE_RUNNING_MS = Math.max(90_000, SPEED_SLA.perImageTimeoutMs * 1.5);
        const staleCutoff = new Date(Date.now() - STALE_RUNNING_MS).toISOString();
        const hdNowIso = new Date().toISOString();
        // Exhausted stale tasks → permanently failed (do NOT requeue)
        const { data: hdStaleExhausted } = await adminClient
          .from("generation_tasks").select("id")
          .eq("job_id", dbJobId).eq("status", "running")
          .lt("updated_at", staleCutoff).gte("attempt_count", effectiveMaxAttempts).is("result_url", null);
        if (hdStaleExhausted && hdStaleExhausted.length > 0) {
          await adminClient.from("generation_tasks").update({
            status: "failed",
            last_error: `Permanently failed: stale + max attempts (> ${Math.round(STALE_RUNNING_MS / 1000)}s)`,
            updated_at: hdNowIso,
          }).in("id", hdStaleExhausted.map((t) => t.id));
        }
        // Non-exhausted stale tasks → requeue (attempt_count preserved, NOT reset)
        await adminClient.from("generation_tasks").update({
          status: "pending", next_run_at: new Date().toISOString(),
          last_error: "Recovered stale home decor task", updated_at: hdNowIso,
        }).eq("job_id", dbJobId).eq("status", "running").lt("updated_at", staleCutoff)
          .lt("attempt_count", effectiveMaxAttempts).is("result_url", null);

        // Fetch one pending task
        const { data: pendingTasks } = await adminClient
          .from("generation_tasks").select("*").eq("job_id", dbJobId).eq("status", "pending")
          .lt("next_run_at", new Date().toISOString()).lt("attempt_count", effectiveMaxAttempts)
          .order("created_at", { ascending: true }).limit(1);

        console.log(`[WORK-HD] Processing ${pendingTasks?.length || 0} home decor tasks`);

        if (pendingTasks && pendingTasks.length > 0) {
          const task = pendingTasks[0];
          const attempt = (task.attempt_count || 0) + 1;
          const viewKey = String(task.view_key);

          console.log(`[TASK-HD] ${task.view_name} attempt=${attempt}/${effectiveMaxAttempts} resolution=${jobResolution} model=${jobModel || ENGINE} providerTimeout=${isHdJob ? "120s" : "60s"} internalRetries=${isHdJob ? "disabled" : "enabled"}`);

          // STATE-02: Atomic claim via FOR UPDATE SKIP LOCKED — prevents concurrent worker race.
          const { data: claimedId } = await adminClient.rpc("claim_generation_task", {
            task_id: task.id,
            p_attempt: attempt,
          });
          if (!claimedId) {
            console.log("[TASK-HD] Task already claimed by another worker");
          } else {
            // No pre-flight credit read — rely on the atomic decrement_credits RPC at deduction time
            // (WR-10: consistent with fashion path after CR-03 fix)
            const creditCost = hdCreditMultiplier;
            {
              // Build prompt
              let prompt = "";
              if (viewKey === "fullProduct") prompt = homeDecorPrompts.fullProduct(bgColor);
              else if (viewKey === "lifestylePrimary") prompt = homeDecorPrompts.lifestylePrimary(formatPlacement(primary));
              else if (viewKey === "lifestyleSecondary") prompt = homeDecorPrompts.lifestyleSecondary(formatPlacement(secondary));
              prompt += ` Output a full-bleed 1:1 image.`;

              try {
                const result = await generateOnce(prompt, [productUrl], false, "1:1", jobResolution as "1K" | "2K", jobModel);
                if (result.ok) {
                  const persistedUrl = await uploadAndGetPath(user.id, viewKey, result.imageUrl, dbJobId, viewKey, "original");
                  // Deduct credits
                  const { data: deductResult, error: deductErr } = await adminClient.rpc("decrement_credits", { user_id: user.id, amount: creditCost });
                  if (deductErr || !deductResult) {
                    // CREDIT-01: CRITICAL ALERT — revenue leak. Image delivered, credits NOT deducted.
                    // Manual reconciliation required: user_id, job_id, task_id, amount
                    const deductFailReason = deductErr ? `db_error=${deductErr.message}` : `rpc_returned_false (insufficient balance at deduction time)`;
                    console.error(`[CREDIT] CRITICAL: Revenue leak detected. user_id=${user.id} job_id=${dbJobId} task_id=${task.id} amount=${creditCost} reason=${deductFailReason}`);
                    // CREDIT-01: Throw so updateTaskResult is never reached — task stays running and
                    // is reset to pending by the pre-exit safety sweep. No image committed as done
                    // without a corresponding credit deduction.
                    throw new Error(`[CREDIT] Revenue leak prevented: credit deduction failed for task ${task.id}`);
                  } else {
                    console.log(`[TASK-HD] ${creditCost} credit(s) deducted`);
                  }
                  await updateTaskResult(task.id, persistedUrl, null);
                  console.log(`[TASK-HD] Done ${task.view_name}`);
                } else {
                  const errClass = result.error.includes("RATE_LIMITED") ? "RATE_LIMITED"
                    : result.error.includes("timed out") ? "PROVIDER_TIMEOUT"
                    : result.error.includes("504") ? "HTTP_504"
                    : result.error.includes("SAFETY") ? "SAFETY_BLOCKED" : "OTHER";
                  console.log(`[TASK-HD] FAILED ${task.view_name} attempt=${attempt} errClass=${errClass} error=${result.error.slice(0, 150)}`);
                  if (attempt >= effectiveMaxAttempts) {
                    await updateTaskResult(task.id, null, result.error);
                  } else {
                    await moveTaskBackToPending(task.id, attempt, result.error);
                  }
                }
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                if (attempt >= effectiveMaxAttempts) {
                  await updateTaskResult(task.id, null, msg);
                } else {
                  await moveTaskBackToPending(task.id, attempt, msg);
                }
              }
            }
          }
        }

        // Update job counts
        await updateJobCounts(dbJobId);
        const { data: refreshed } = await adminClient.from("generation_jobs").select("status, tasks_total, tasks_done, tasks_failed").eq("id", dbJobId).maybeSingle();

        return new Response(
          JSON.stringify({ jobId: dbJobId, progress: refreshed || { status: "running", tasks_total: 0, tasks_done: 0, tasks_failed: 0 } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // ══════════════════════════════════════════════════════════════════
      // FASHION work path (existing)
      // ══════════════════════════════════════════════════════════════════
      const selectedProductType: ProductType = (cfg.productType as ProductType) || "top";
      const selectedViewPose: ViewPose = (cfg.viewPose as ViewPose) || "full-body";
      const bg = (cfg.backgroundColor as string) || "#F7F7F7";
      const cityForJob = (cfg.city as string) || "Paris";
      const seasonForJob = (cfg.season as string) || "summer";
      const aspectRatioJobText = (cfg.aspectRatio as string) || "1:1";
      const aspectRatioJobPrompt = `Output a full-bleed ${aspectRatioJobText} image.`;
      const viewConfigs = (cfg.viewConfigs || {}) as Record<string, { pose?: string; customPrompt?: string }>;

      const blueprint = (cfg.productDescriptor?.blueprint as ProductBlueprint | null)
        ?? (cfg.productDescriptor as ProductBlueprint | null)
        ?? null;

      const signPath = async (path: string, expiresSec = 60 * 60 * 24) => {
        const { data, error } = await adminClient.storage.from(STORAGE_BUCKET).createSignedUrl(path, expiresSec);
        if (error || !data?.signedUrl) return null;
        return data.signedUrl;
      };

      const productPath = cfg.product_path as string | undefined;
      if (!productPath) {
        return new Response(JSON.stringify({ error: "Job is missing product image" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const productUrl = await signPath(productPath);
      if (!productUrl) {
        return new Response(JSON.stringify({ error: "Failed to sign product image" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const modelProfile = job.model_lock as unknown as ModelProfile;

      console.log(`[WORK] JOB=${dbJobId} MODEL=${modelProfile.lockString} TYPE=${selectedProductType} BLUEPRINT=${blueprint?.descriptorString || "default"}`);

      // ── Step 3: Anchor generation ──────────────────────────────────────
      let anchorUrl = job.anchor_url as string | null;
      const anchorCachePath = `${user.id}/anchor-cache/${modelProfile.modelKey}.png`;

      if (!anchorUrl) {
        const cached = await trySignExisting(anchorCachePath);
        if (cached) {
          anchorUrl = cached;
          await adminClient.from("generation_jobs").update({ anchor_url: anchorUrl, updated_at: new Date().toISOString() }).eq("id", dbJobId);
          console.log("[ANCHOR] Cache hit (reused)");
        }
      }

      // Skip anchor for single-view jobs (anchor only helps multi-view consistency)
      const { count: totalTaskCount } = await adminClient
        .from("generation_tasks").select("id", { count: "exact", head: true }).eq("job_id", dbJobId);

      if (!anchorUrl && (totalTaskCount ?? 0) > 1) {
        console.log("[ANCHOR] Generating anchor image...");
        const anchorPrompt = buildAnchorPrompt(modelProfile, aspectRatioJobText);
        const anchorStart = Date.now();
        const anchorResult = await generateOnce(`${anchorPrompt}\n\n${aspectRatioJobPrompt}`, [productUrl]);
        if (anchorResult.ok) {
          anchorUrl = await uploadAndSignAtPath(anchorCachePath, anchorResult.imageUrl);
          await adminClient.from("generation_jobs").update({ anchor_url: anchorUrl, updated_at: new Date().toISOString() }).eq("id", dbJobId);
          console.log(`[ANCHOR] Created in ${((Date.now() - anchorStart) / 1000).toFixed(1)}s`);
        } else {
          console.log(`[ANCHOR] Failed: ${anchorResult.error}, continuing without anchor`);
        }

        // For HD jobs, return early after anchor generation so HD task gets its own full call window
        if (isHdJob) {
          console.log(`[ANCHOR] HD job — returning early after anchor generation to give HD task a full call window`);
          await updateJobCounts(dbJobId);
          const { data: refreshed } = await adminClient.from("generation_jobs").select("status, tasks_total, tasks_done, tasks_failed").eq("id", dbJobId).maybeSingle();
          return new Response(
            JSON.stringify({ jobId: dbJobId, progress: refreshed || { status: "running", tasks_total: 0, tasks_done: 0, tasks_failed: 0 } }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } else if (!anchorUrl) {
        console.log("[ANCHOR] Single-view job, skipping anchor generation");
      }

      const identityAnchor: IdentityAnchor | null = anchorUrl ? { anchorUrl, modelProfile } : null;

      // ── Stale task recovery ────────────────────────────────────────────
      const STALE_RUNNING_MS = Math.max(90_000, SPEED_SLA.perImageTimeoutMs * 1.5);
      const staleCutoff = new Date(Date.now() - STALE_RUNNING_MS).toISOString();
      const nowIso = new Date().toISOString();

      {
        // STATE-01 / STATE-03: Stale exhausted tasks → permanently failed (do NOT requeue to pending).
        // Mirrors homeDecor path. Requeueing caused attempt_count confusion and infinite cascades.
        const { data: staleExhausted } = await adminClient
          .from("generation_tasks").select("id").eq("job_id", dbJobId).eq("status", "running")
          .lt("updated_at", staleCutoff).gte("attempt_count", effectiveMaxAttempts).is("result_url", null).limit(200);

        if (staleExhausted && staleExhausted.length > 0) {
          const ids = staleExhausted.map((t) => t.id);
          console.log(`[WORK] Permanently failing ${ids.length} stale exhausted running tasks (attempt_count at limit)`);
          await adminClient.from("generation_tasks").update({
            status: "failed",
            last_error: `Permanently failed: stale + max attempts (> ${Math.round(STALE_RUNNING_MS / 1000)}s)`,
            updated_at: nowIso,
          }).in("id", ids);
        }
      }

      {
        await adminClient.from("generation_tasks").update({
          status: "pending",
          next_run_at: new Date(Date.now() + 1000).toISOString(),
          last_error: `Recovered stale task (> ${Math.round(STALE_RUNNING_MS / 1000)}s)`,
          updated_at: nowIso,
        }).eq("job_id", dbJobId).eq("status", "running").lt("updated_at", staleCutoff).lt("attempt_count", effectiveMaxAttempts).is("result_url", null);
      }

      {
        const { data: pendingExhausted } = await adminClient
          .from("generation_tasks").select("id, status, last_error, attempt_count, result_url").eq("job_id", dbJobId).eq("status", "pending")
          .gte("attempt_count", effectiveMaxAttempts).limit(500);

        if (pendingExhausted && pendingExhausted.length > 0) {
          // First: any "pending" task that already has a result_url was incorrectly downgraded — fix it
          const downgraded = pendingExhausted.filter((t) => t.result_url);
          if (downgraded.length > 0) {
            console.log(`[WORK] Fixing ${downgraded.length} incorrectly downgraded tasks that already have results`);
            await adminClient.from("generation_tasks").update({
              status: "done",
              last_error: null,
              updated_at: nowIso,
            }).in("id", downgraded.map((t) => t.id));
          }

          const trulyExhausted = pendingExhausted.filter((t) => !t.result_url);
          const alreadyRecovered = trulyExhausted.filter((t) => t.attempt_count > effectiveMaxAttempts);
          const firstTimeExhausted = trulyExhausted.filter((t) => t.attempt_count === effectiveMaxAttempts);

          if (alreadyRecovered.length > 0) {
            console.log(`[WORK] Permanently failing ${alreadyRecovered.length} tasks that already had a recovery attempt`);
            for (const task of alreadyRecovered) {
              const originalError = task.last_error || "Unknown error";
              await adminClient.from("generation_tasks").update({
                status: "failed",
                last_error: `Permanently failed: ${originalError}`,
                updated_at: nowIso,
              }).eq("id", task.id);
            }
          }

          if (firstTimeExhausted.length > 0) {
            const ids = firstTimeExhausted.map((t) => t.id);
            // STATE-01 FIX: Do NOT reset attempt_count — that caused infinite retry loops.
            // These tasks are genuinely exhausted. Mark them permanently failed.
            console.log(`[WORK] Permanently failing ${ids.length} exhausted pending tasks (attempt_count at limit, no reset)`);
            await adminClient.from("generation_tasks").update({
              status: "failed",
              last_error: "Permanently failed: max attempts reached",
              updated_at: nowIso,
            }).in("id", ids);
          }
        }
      }

      // ── Fetch pending tasks ────────────────────────────────────────────
      const MAX_TASKS_PER_CALL = 1;
      const { data: pendingTasks, error: pendingErr } = await adminClient
        .from("generation_tasks").select("*").eq("job_id", dbJobId).eq("status", "pending")
        .lt("next_run_at", new Date().toISOString()).lt("attempt_count", effectiveMaxAttempts)
        .order("is_base", { ascending: false }).order("created_at", { ascending: true })
        .limit(MAX_TASKS_PER_CALL);

      if (pendingErr) {
        console.error("[WORK] Failed to fetch tasks:", pendingErr);
        return new Response(JSON.stringify({ error: "Failed to fetch tasks" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[WORK] Processing ${pendingTasks?.length || 0} tasks`);

      const invocationDeadline = JOB_START + MAX_JOB_TIME_MS;
      let lastJobCountsUpdateAt = 0;
      const maybeUpdateJobCounts = async (force = false) => {
        const now = Date.now();
        if (force || now - lastJobCountsUpdateAt > 6000) {
          lastJobCountsUpdateAt = now;
          try { await updateJobCounts(dbJobId); } catch (e) { console.error("[WORK] updateJobCounts error:", e); }
        }
      };
      await maybeUpdateJobCounts(true);

      // ── Process single task ────────────────────────────────────────────
      // WR-08: Track only task IDs successfully claimed by THIS invocation.
      // Using all pendingTasks IDs (before claim) caused the pre-exit sweep to
      // reset tasks owned by other workers — triggering double-processing and
      // double credit deduction.
      const actuallyClaimedTaskIds = new Set<string>();

      const processTask = async (task: any) => {
        if (Date.now() > invocationDeadline - 1000) return;

        const taskStart = Date.now();
        const attempt = (task.attempt_count || 0) + 1;
        const viewKey = String(task.view_key);
        const viewName = String(task.view_name);
        const variantName = String(task.variant_name);
        const variantColor = task.variant_color ? String(task.variant_color) : null;
        const taskSeed = String(task.task_seed);

        console.log(`[TASK] ${viewName} (${variantName}) attempt=${attempt}/${effectiveMaxAttempts} resolution=${jobResolution} model=${jobModel || ENGINE} providerTimeout=${isHdJob ? "120s" : "60s"} internalRetries=${isHdJob ? "disabled" : "enabled"}`);
        if (task.is_base) {
          console.log(`[COLOR] Base view ${viewName} — original color: ${blueprint?.originalColor || "unknown"}`);
        } else if (variantColor) {
          console.log(`[COLOR] Variant ${viewName} — target: ${variantName} (${variantColor})`);
        }

        // STATE-02: Atomic claim via FOR UPDATE SKIP LOCKED — prevents concurrent worker race.
        const { data: claimedId } = await adminClient.rpc("claim_generation_task", {
          task_id: task.id,
          p_attempt: attempt,
        });
        if (!claimedId) return;

        // WR-08: Register successful claim so pre-exit sweep only touches OUR tasks.
        actuallyClaimedTaskIds.add(task.id);

        // No pre-flight credit read — rely solely on the atomic decrement_credits RPC at deduction
        // time (CR-03: the pre-flight check created a TOCTOU race with parallel workers).
        const creditCost = hdCreditMultiplier;

        // WR-07: track success so finally block skips the deadline reset for completed tasks
        let taskSucceeded = false;
        try {
          // Color variant path: edit an existing base view image
          let baseViewUrl: string | null = null;
          if (!task.is_base) {
            const { data: baseTask } = await adminClient
              .from("generation_tasks").select("result_url").eq("job_id", dbJobId)
              .eq("view_key", viewKey).eq("is_base", true).eq("status", "done").maybeSingle();
            const rawPath = baseTask?.result_url ?? null;
            baseViewUrl = rawPath ? await signStoragePathOrUrl(rawPath) : null;
            if (!baseViewUrl) {
              await adminClient.from("generation_tasks").update({
                status: "pending", next_run_at: new Date(Date.now() + 1000).toISOString(),
                last_error: "Waiting for base view", updated_at: new Date().toISOString(),
              }).eq("id", task.id);
              return;
            }
          }

          const formatSpec = getFormatSpec(aspectRatioJobText);

          // ── Step 5: Color variant edit ─────────────────────────────────
          if (!task.is_base && baseViewUrl && variantColor) {
            console.log(`[COLORVARIANT] Editing ${viewName} to ${variantName}`);

            let colorEditSuccess = false;
            let finalImageUrl: string | null = null;
            let lastError = "Color edit failed";

            for (let colorRetry = 0; colorRetry < SPEED_SLA.colorEditMaxRetries; colorRetry++) {
              const editPrompt = buildStrictColorEditPrompt(
                selectedProductType,
                { color: variantColor, name: variantName },
                blueprint,
                colorRetry,
              );
              const editResult = await editOnceWithGuards(
                editPrompt, baseViewUrl, selectedProductType, blueprint, colorRetry,
                formatSpec.aspect, jobResolution as "1K" | "2K", jobModel,
              );
              if (!editResult.ok) {
                lastError = editResult.error;
                console.log(`[COLORVARIANT] Edit attempt ${colorRetry + 1} failed: ${editResult.error}`);
                continue;
              }
              finalImageUrl = editResult.imageUrl;
              colorEditSuccess = true;
              console.log(`[COLORVARIANT] Success on attempt ${colorRetry + 1}`);
              break;
            }

            if (colorEditSuccess && finalImageUrl) {
              const persistedUrl = await uploadAndGetPath(user.id, `${viewName}-${variantName}`, finalImageUrl, dbJobId, viewKey, variantName);
              // CREDIT-02: Guard against double deduction — another worker may have
              // completed this task in the race window between our upload and now.
              const { data: taskCheck } = await adminClient
                .from("generation_tasks").select("status").eq("id", task.id).maybeSingle();
              if (taskCheck?.status === "done") {
                console.log(`[TASK] Task ${task.id} already completed by another worker, skipping credit deduction`);
                taskSucceeded = true;
                return;
              }
              // Deduct credits on success
              const { data: deductResult, error: deductErr } = await adminClient.rpc("decrement_credits", { user_id: user.id, amount: creditCost });
              if (deductErr || !deductResult) {
                // CREDIT-01: CRITICAL ALERT — revenue leak. Image delivered, credits NOT deducted.
                const deductFailReason = deductErr ? `db_error=${deductErr.message}` : `rpc_returned_false (insufficient balance at deduction time)`;
                console.error(`[CREDIT] CRITICAL: Revenue leak detected. user_id=${user.id} job_id=${dbJobId} task_id=${task.id} amount=${creditCost} reason=${deductFailReason}`);
                // CREDIT-01: Throw so updateTaskResult is never reached.
                throw new Error(`[CREDIT] Revenue leak prevented: credit deduction failed for task ${task.id}`);
              } else {
                console.log(`[TASK] ${creditCost} credit(s) deducted for successful color variant`);
              }
              await updateTaskResult(task.id, persistedUrl, null);
              taskSucceeded = true;
              console.log(`[TASK] Done ${viewName} (${variantName}) in ${((Date.now() - taskStart) / 1000).toFixed(1)}s`);
              console.log(`[COLOR] ✓ ${viewName} (${variantName}) completed — color target was: ${variantColor || "original"}`);
            } else {
              if (attempt >= effectiveMaxAttempts) {
                console.log(`[COLORVARIANT] ${viewName} (${variantName}) failed after ${attempt} attempts, marking as failed`);
                console.log(`[COLOR] ✗ ${viewName} (${variantName}) failed — color target was: ${variantColor || "original"}, error: ${lastError}`);
                await updateTaskResult(task.id, null, lastError);
              } else {
                await moveTaskBackToPending(task.id, attempt, lastError);
              }
            }
            return;
          }

          // ── Step 4: Base view generation ───────────────────────────────
          const viewConfig = viewConfigs[viewKey] || {};
          const customPose = viewConfig.pose || null;
          const customPrompt = viewConfig.customPrompt || null;
          const variantColorForTask = task.variant_color || null;
          const isBaseForTask = task.is_base || false;

          // CONFIG-04/05: Read color variants from job config snapshot — no per-task DB query
          const colorVariantsSnapshot = (cfg.color_variants as Array<{ id: string; name: string; color: string | null; isBase: boolean }>) || [];
          const allVariantColors = colorVariantsSnapshot.map((v) => v.color).filter((c): c is string => !!c);

          const basePrompt = buildFashionPrompt(
            modelProfile, selectedProductType, selectedViewPose, viewKey, viewName,
            bg, cityForJob, identityAnchor, taskSeed, blueprint, seasonForJob,
            customPose, customPrompt, aspectRatioJobText,
            variantColorForTask, isBaseForTask, allVariantColors, jobResolution,
          );

          const isOutdoorView = viewKey.toLowerCase() === "outdoor" || viewName.toLowerCase().includes("outdoor");

          const resolutionLabel = jobResolution === "2K" ? "2048px minimum" : "1024px minimum";
          const hdDetailBoost = jobResolution === "2K"
            ? `\n- Fabric weave and stitch detail must be individually resolvable. Skin pores visible at 100% crop.\n- Specular micro-highlights on buttons, zippers, and hardware. Tonal gradients with zero banding.`
            : "";
          const sharpnessBoost = isOutdoorView
            ? `
QUALITY REQUIREMENTS (CRITICAL):
- Aspect ratio: EXACTLY ${formatSpec.aspect} (${formatSpec.width}x${formatSpec.height} target)
- Long-edge resolution: ${resolutionLabel}
- Natural outdoor lighting — preserve directional sun, real shadows, atmospheric depth
- Background with natural bokeh and depth-of-field — NOT uniformly sharp
- Natural skin texture, no plastic look
- Photographic realism — this must look like a real photograph, not CGI
- Single clean image, no collage/grid${hdDetailBoost}`
            : `
QUALITY REQUIREMENTS (CRITICAL):
- Aspect ratio: EXACTLY ${formatSpec.aspect} (${formatSpec.width}x${formatSpec.height} target)
- Long-edge resolution: ${resolutionLabel}
- Sharp focus on garment - no motion blur, no depth blur on product
- Clean commercial lighting, no harsh shadows
- Natural skin texture, no plastic look
- PNG quality, maximum detail
- Single clean image, no collage/grid${hdDetailBoost}`;

          const inputs: string[] = [productUrl];
          if (identityAnchor) inputs.push(identityAnchor.anchorUrl);

          const viewResolution = jobResolution as "1K" | "2K";

          let generated = await generateOnce(
            `${basePrompt}\n\n${sharpnessBoost}\n\n${aspectRatioJobPrompt}`,
            inputs, false, formatSpec.aspect, viewResolution, jobModel,
          );

          if (!generated.ok && generated.timedOut && SPEED_SLA.useFastPresetOnTimeout && attempt < effectiveMaxAttempts) {
            console.log(`[TASK] Base render timed out, retrying with fast preset`);
            generated = await generateOnce(`${basePrompt}\n\nFAST RENDER: Sharp focus, ${formatSpec.aspect} aspect, commercial quality.`, inputs, true, formatSpec.aspect, viewResolution, jobModel);
          }

          if (generated.ok) {
            let processedImageUrl = generated.imageUrl;

            // Format gate (deterministic math check)
            logGate({ taskId: task.id, gateName: "LayoutGate", passed: true, retryCount: attempt, latencyMs: 0 });
            const formatCheck = runFormatGate(processedImageUrl, formatSpec, task.id, attempt, getImageDimensions);

            if (!formatCheck.passed && attempt < effectiveMaxAttempts) {
              console.log(`[TASK] FormatGate failed: ${formatCheck.reason}`);
              await moveTaskBackToPending(task.id, attempt, formatCheck.reason || "Aspect ratio mismatch");
              return;
            }

            // Product-focused deterministic crop (BEFORE full-bleed, guarantees framing)
            let skipFullBleed = false;
            if (selectedViewPose === "product-focused") {
              const { enforceProductFocusedCrop } = await import("./canvas-helper.ts");
              const cropResult = await enforceProductFocusedCrop(
                processedImageUrl, formatSpec.width, formatSpec.height, selectedProductType, aspectRatioJobText,
              );
              if (cropResult.ok) {
                processedImageUrl = cropResult.imageUrl;
                // If crop was applied (image is already at target dimensions), skip redundant full-bleed
                // This eliminates one full WASM decode+encode cycle to stay within CPU budget
                skipFullBleed = true;
                console.log(`[TASK] Product-focused crop applied for ${selectedProductType} (${aspectRatioJobText}) — skipping full-bleed`);
              } else {
                console.error(`[TASK] Product-focused crop failed: ${cropResult.error}`);
              }
            }

            // Aspect ratio enforcement via full-bleed canvas (skip if product-focused crop already applied)
            if (!skipFullBleed) {
              const isOutdoorView = viewKey.toLowerCase() === "outdoor" || viewName.toLowerCase().includes("outdoor");
              const bleedResult = await createFullBleedCanvas(
                processedImageUrl, formatSpec.width, formatSpec.height,
                isOutdoorView ? "mirror" : "studio", bg,
                isOutdoorView ? 1.05 : 1.0,
              );
              if (bleedResult.ok) {
                processedImageUrl = bleedResult.imageUrl;
              } else {
                console.error(`[TASK] Full-bleed enforcement failed: ${bleedResult.error}`);
              }
            }

            const persistedUrl = await uploadAndGetPath(user.id, `${viewName}-${variantName}`, processedImageUrl, dbJobId, viewKey, variantName);
            // CREDIT-02: Guard against double deduction — another worker may have
            // completed this task in the race window between our upload and now.
            const { data: taskCheck } = await adminClient
              .from("generation_tasks").select("status").eq("id", task.id).maybeSingle();
            if (taskCheck?.status === "done") {
              console.log(`[TASK] Task ${task.id} already completed by another worker, skipping credit deduction`);
              taskSucceeded = true;
              return;
            }
            // Deduct credits on success
            const { data: deductResult, error: deductErr } = await adminClient.rpc("decrement_credits", { user_id: user.id, amount: creditCost });
            if (deductErr || !deductResult) {
              // CREDIT-01: CRITICAL ALERT — revenue leak. Image delivered, credits NOT deducted.
              const deductFailReason = deductErr ? `db_error=${deductErr.message}` : `rpc_returned_false (insufficient balance at deduction time)`;
              console.error(`[CREDIT] CRITICAL: Revenue leak detected. user_id=${user.id} job_id=${dbJobId} task_id=${task.id} amount=${creditCost} reason=${deductFailReason}`);
              // CREDIT-01: Throw so updateTaskResult is never reached.
              throw new Error(`[CREDIT] Revenue leak prevented: credit deduction failed for task ${task.id}`);
            } else {
              console.log(`[TASK] ${creditCost} credit(s) deducted for successful base view`);
            }
            await updateTaskResult(task.id, persistedUrl, null);
            taskSucceeded = true;
            const elapsed = ((Date.now() - taskStart) / 1000).toFixed(1);
            console.log(`[TASK] Done ${viewName} (${variantName}) in ${elapsed}s [F:${formatCheck.passed ? "OK" : "BYPASS"}] -> ${formatSpec.aspect}`);
            console.log(`[COLOR] ✓ ${viewName} (${variantName}) completed — color target was: ${variantColor || "original"}`);
            return;
          }

          // Handle credits exhausted
          if (!generated.retryable && generated.status === 402) {
            await updateTaskResult(task.id, null, "Credits exhausted");
            await updateJobCounts(dbJobId);
            throw new Error("Credits exhausted");
          }

          if (attempt < effectiveMaxAttempts) {
            await moveTaskBackToPending(task.id, attempt, generated.error);
          } else {
            // Mark as permanently failed — no refund needed since credits weren't deducted
            const { data: claimed } = await adminClient
              .from("generation_tasks")
              .update({ status: "failed", updated_at: new Date().toISOString() })
              .eq("id", task.id)
              .eq("status", "running")
              .select("id")
              .maybeSingle();

            if (claimed) {
              const is4xxValidation = generated.status && generated.status >= 400 && generated.status < 500;
              if (is4xxValidation) {
                console.log(`[TASK] Final attempt failed with provider validation error (${generated.status}): ${generated.error}`);
                await updateTaskResult(task.id, null, generated.error || `Provider validation error (${generated.status})`);
              } else {
                console.log(`[TASK] Final attempt failed after ${effectiveMaxAttempts} retries`);
                await updateTaskResult(task.id, null, `Image generation failed after ${effectiveMaxAttempts} attempts. Please retry.`);
              }
            } else {
              console.log(`[TASK] Skipping update for task ${task.id} — another worker already handled it`);
            }
          }
        } finally {
          if (!taskSucceeded && Date.now() > invocationDeadline - 250) {
            await adminClient.from("generation_tasks").update({
              status: "pending",
              last_error: "Worker interrupted",
              next_run_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq("id", task.id).eq("status", "running");
          }
          await maybeUpdateJobCounts(false);
        }
      };

      // ── Run tasks with bounded concurrency ─────────────────────────────
      const tasks = pendingTasks || [];
      const baseTasks = tasks.filter((t) => t.is_base);
      const variantTasks = tasks.filter((t) => !t.is_base);

      const runWithConcurrency = async (items: any[], concurrency: number) => {
        const results: Array<PromiseSettledResult<void>> = new Array(items.length);
        const limit = Math.max(1, Math.min(concurrency, items.length));
        let cursor = 0;
        await Promise.all(
          Array.from({ length: limit }).map(async () => {
            while (true) {
              const i = cursor++;
              if (i >= items.length) break;
              try {
                await processTask(items[i]);
                results[i] = { status: "fulfilled", value: undefined };
              } catch (e) {
                results[i] = { status: "rejected", reason: e } as PromiseRejectedResult;
              }
            }
          }),
        );
        return results;
      };

      if (baseTasks.length > 0) {
        const baseConcurrency = Math.min(baseTasks.length, SPEED_SLA.baseRenderConcurrency);
        console.log(`[WORK] Processing ${baseTasks.length} base tasks (concurrency=${baseConcurrency})`);
        const baseResults = await runWithConcurrency(baseTasks, baseConcurrency);
        if (baseResults.some((r) => r?.status === "rejected" && String((r as PromiseRejectedResult).reason || "").includes("Credits exhausted"))) {
          return new Response(JSON.stringify({ error: "Credits exhausted. Please add more credits.", jobId: dbJobId }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        await maybeUpdateJobCounts(true);
      }

      if (variantTasks.length > 0 && Date.now() < invocationDeadline - 1000) {
        const variantConcurrency = Math.min(variantTasks.length, SPEED_SLA.upscaleConcurrency);
        console.log(`[WORK] Processing ${variantTasks.length} variant tasks (concurrency=${variantConcurrency})`);
        const variantResults = await runWithConcurrency(variantTasks, variantConcurrency);
        if (variantResults.some((r) => r?.status === "rejected" && String((r as PromiseRejectedResult).reason || "").includes("Credits exhausted"))) {
          return new Response(JSON.stringify({ error: "Credits exhausted. Please add more credits.", jobId: dbJobId }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      await maybeUpdateJobCounts(true);

      // ── Crash-safety sweep: only reset tasks THIS invocation claimed ──
      // WR-08: Use actuallyClaimedTaskIds (successful claims only) instead of
      // pendingTasks IDs (pre-claim snapshot) to avoid resetting tasks owned by
      // other concurrent workers.
      const claimedTaskIds = Array.from(actuallyClaimedTaskIds);
      if (claimedTaskIds.length > 0) {
        const { data: stillRunning } = await adminClient
          .from("generation_tasks")
          .select("id")
          .eq("job_id", dbJobId)
          .eq("status", "running")
          .is("result_url", null)
          .in("id", claimedTaskIds);
        if (stillRunning && stillRunning.length > 0) {
          const ids = stillRunning.map((t: any) => t.id);
          await adminClient.from("generation_tasks").update({
            status: "pending",
            last_error: "Pre-exit safety reset (own worker)",
            next_run_at: new Date(Date.now() + 2000).toISOString(),
            updated_at: new Date().toISOString(),
          }).in("id", ids);
          console.log(`[WORK] Pre-exit sweep: reset ${ids.length} own running tasks to pending`);
        }
      }

      const { data: refreshed } = await adminClient.from("generation_jobs").select("status, tasks_total, tasks_done, tasks_failed").eq("id", dbJobId).maybeSingle();

      return new Response(
        JSON.stringify({ jobId: dbJobId, progress: refreshed || { status: "running", tasks_total: 0, tasks_done: 0, tasks_failed: 0 } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ════════════════════════════════════════════════════════════════════════
    // ACTION = "reconcile"
    // ════════════════════════════════════════════════════════════════════════
    if (action === "reconcile" && resumeJobId) {
      if (!adminClient) {
        return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const dbJobId = resumeJobId;
      const { data: job, error: jobErr } = await adminClient.from("generation_jobs").select("*").eq("id", dbJobId).maybeSingle();
      if (jobErr || !job) {
        return new Response(JSON.stringify({ error: "Job not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (job.user_id !== user.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: existingTasks } = await adminClient.from("generation_tasks").select("view_key, variant_key, variant_name, status").eq("job_id", dbJobId);
      const failedKeys = new Set((existingTasks || []).filter((t) => t.status === "failed").map((t) => `${t.view_key}|${t.variant_key}`));

      if (failedKeys.size > 0) {
        await adminClient.from("generation_tasks").update({
          status: "pending", attempt_count: 0, next_run_at: new Date().toISOString(),
          last_error: null, updated_at: new Date().toISOString(),
        }).eq("job_id", dbJobId).eq("status", "failed");
        console.log(`[RECONCILE] Reset ${failedKeys.size} failed tasks to pending`);
      }

      await adminClient.from("generation_jobs").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", dbJobId);
      await updateJobCounts(dbJobId);

      const { data: refreshed } = await adminClient.from("generation_jobs").select("status, tasks_total, tasks_done, tasks_failed").eq("id", dbJobId).maybeSingle();

      return new Response(
        JSON.stringify({ jobId: dbJobId, reconciledCount: failedKeys.size, progress: refreshed || { status: "running", tasks_total: 0, tasks_done: 0, tasks_failed: 0 } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ════════════════════════════════════════════════════════════════════════
    // ACTION = "start" — Fashion
    // ════════════════════════════════════════════════════════════════════════
    if (isFashion && views && views.length > 0) {
      const age = modelAge || 25;
      const bg = backgroundColor || "#F7F7F7";
      const selectedEthnicity = ethnicity || "caucasian";
      const selectedSkinTone = skinTone || "medium";
      const selectedGender: "male" | "female" = gender || "female";
      const selectedProductType: ProductType = productType || "top";
      const selectedViewPose: ViewPose = viewPose || "full-body";

      const selectedAspectRatio = aspectRatio || "1:1";
      if (!isValidAspectRatio(selectedAspectRatio)) {
        return new Response(JSON.stringify({ error: `Invalid aspect ratio "${selectedAspectRatio}".` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const formatSpec = getFormatSpec(selectedAspectRatio);

      const JOB_ID = crypto.randomUUID();
      const modelProfile = createModelProfile(selectedGender, selectedEthnicity, selectedSkinTone, age, JOB_ID);

      console.log(`[START] JOB=${JOB_ID} MODEL=${modelProfile.lockString} TYPE=${selectedProductType} FORMAT=${formatSpec.aspect}->${formatSpec.width}x${formatSpec.height}`);

      const VIEW_ORDER = ["front", "side", "back", "outdoor"];
      const sortedViews = [...filterDisallowedViews(views)].sort((a, b) => {
        const aId = (typeof a === "string" ? a : a.id).toLowerCase();
        const bId = (typeof b === "string" ? b : b.id).toLowerCase();
        return (VIEW_ORDER.indexOf(aId) >= 0 ? VIEW_ORDER.indexOf(aId) : 99) - (VIEW_ORDER.indexOf(bId) >= 0 ? VIEW_ORDER.indexOf(bId) : 99);
      });

      const allVariants: Array<{ color: string | null; name: string; isBase: boolean; id: string }> = [
        { color: null, name: "Original", isBase: true, id: "original" },
        ...(colorVariants || []).map((v, i) => ({
          color: v.color,
          name: v.name,
          isBase: false,
          id: (v as any).id || `${v.name}-${v.color}-${i}`,
        })),
      ];

      const tasksTotal = sortedViews.length * allVariants.length;
      
      // MAX_IMAGES_PER_JOB guardrail
      if (tasksTotal > MAX_IMAGES_PER_JOB) {
        return new Response(JSON.stringify({ error: `Too many images requested (${tasksTotal}). Maximum is ${MAX_IMAGES_PER_JOB} per job.` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      console.log(`[START] VIEWS=${sortedViews.length} VARIANTS=${allVariants.length} TOTAL=${tasksTotal} RESOLUTION=${resolution}`);

      const productHash = await computeProductHash(productImage!);
      console.log(`[START] PRODUCT_HASH=${productHash}`);

      // Upload product image
      const { bytes, contentType, ext } = dataUrlToBytes(productImage!);
      const productPath = `jobs/${JOB_ID}/product.${ext}`;
      const { error: uploadError } = await adminClient!.storage.from(STORAGE_BUCKET).upload(productPath, bytes, { contentType, upsert: true });
      if (uploadError) {
        console.error("[START] Product upload error:", uploadError);
        return new Response(JSON.stringify({ error: "Failed to store product image" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Step 2: Extract product blueprint
      const productUrl = await trySignExisting(productPath);
      let blueprint: ProductBlueprint | null = null;
      if (productUrl) {
        console.log("[PRODUCTLOCK] Extracting product blueprint...");
        blueprint = await extractProductBlueprint(productUrl, selectedProductType, waitForRateLimit);
        console.log(`[PRODUCTLOCK] Blueprint: ${blueprint?.descriptorString || "default"}`);
      }

      // Pre-process product image to full-bleed
      let processedProductPath = productPath;
      if (productUrl) {
        console.log(`[FORMATLOCK] Applying Full Bleed pre-processing...`);
        const { ok, imageUrl: bleedUrl, error: bleedError } = await createFullBleedCanvas(productUrl, formatSpec.width, formatSpec.height, "studio", "#F7F7F7");
        if (ok && bleedUrl) {
          const { bytes: bleedBytes, contentType: bleedType, ext: bleedExt } = dataUrlToBytes(bleedUrl);
          const bleedPath = `jobs/${JOB_ID}/product_fullbleed.${bleedExt}`;
          await adminClient!.storage.from(STORAGE_BUCKET).upload(bleedPath, bleedBytes, { contentType: bleedType, upsert: true });
          processedProductPath = bleedPath;
          console.log(`[FORMATLOCK] Processed input saved to: ${bleedPath}`);
        } else {
          console.error(`[FORMATLOCK] Failed: ${bleedError}`);
        }
      }

      // Create job row
      const { error: jobInsertError } = await adminClient!.from("generation_jobs").insert({
        id: JOB_ID,
        user_id: user.id,
        status: "running",
        niche: "fashion",
        tasks_total: tasksTotal,
        tasks_done: 0,
        tasks_failed: 0,
        provider_id: resolution === "2K" ? HD_ENGINE : ENGINE,
        model_lock: modelProfile,
        job_seed: modelProfile.jobSeed,
        product_hash: productHash,
        target_width: formatSpec.width,
        target_height: formatSpec.height,
        aspect_ratio: formatSpec.aspect,
        config: {
          backgroundColor: bg,
          city,
          season: season || "summer",
          productType: selectedProductType,
          viewPose: selectedViewPose,
          aspectRatio: formatSpec.aspect,
          targetWidth: formatSpec.width,
          targetHeight: formatSpec.height,
          product_path: processedProductPath,
          productDescriptor: blueprint,
          resolution,
          // CONFIG-01/02: Snapshot model string at job creation — workers must read this, never re-derive
          model_engine: resolution === "2K" ? HD_ENGINE : ENGINE,
          // CONFIG-04/05: Snapshot color variant map — workers read from here, not from DB or tasks
          color_variants: allVariants.map((v) => ({ id: v.id, name: v.name, color: v.color, isBase: v.isBase })),
          viewConfigs: sortedViews.reduce(
            (acc, rawView) => {
              const v = normalizeView(rawView);
              acc[v.id] = { pose: v.pose, customPrompt: v.customPrompt };
              return acc;
            },
            {} as Record<string, { pose?: string; customPrompt?: string }>,
          ),
        },
      });

      if (jobInsertError) {
        console.error("[START] Failed to create job:", jobInsertError);
        return new Response(JSON.stringify({ error: "Database error creating job", details: jobInsertError }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Create task rows
      const taskInserts = [] as any[];
      for (const rawView of sortedViews) {
        const v = normalizeView(rawView);
        for (const variant of allVariants) {
          taskInserts.push({
            job_id: JOB_ID,
            view_key: v.id,
            view_name: v.name || v.id,
            variant_key: variant.id,
            variant_name: variant.name,
            variant_color: variant.color,
            is_base: variant.isBase,
            task_seed: deriveTaskSeed(modelProfile.modelKey, v.id, variant.id),
            status: "pending",
            attempt_count: 0,
            max_attempts: resolution === "2K" ? RATE_LIMIT_CONFIG.hdMaxAttempts : RATE_LIMIT_CONFIG.maxAttempts,
            next_run_at: new Date().toISOString(),
            product_hash: productHash,
            aspect_ratio: formatSpec.aspect,
            target_width: formatSpec.width,
            target_height: formatSpec.height,
          });
        }
      }

      const { error: taskErr } = await adminClient!
        .from("generation_tasks")
        .upsert(taskInserts, { onConflict: "job_id,view_key,variant_key", ignoreDuplicates: true });
      if (taskErr) console.error("[START] Failed to create tasks:", taskErr);

      console.log(`[START] Created job ${JOB_ID} with ${tasksTotal} tasks + ProductLock + FormatLock(${formatSpec.aspect})`);

      return new Response(
        JSON.stringify({ jobId: JOB_ID, tasksTotal, formatLock: { aspect: formatSpec.aspect, width: formatSpec.width, height: formatSpec.height } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ════════════════════════════════════════════════════════════════════════
    // ACTION = "start" — Home Decor
    // ════════════════════════════════════════════════════════════════════════
    if (niche === "homeDecor" && perspectives && perspectives.length > 0) {
      const VIEW_NAME_MAP: Record<string, string> = {
        fullProduct: "Full Product",
        lifestylePrimary: "Lifestyle Primary",
        lifestyleSecondary: "Lifestyle Secondary",
      };

      const homeDecorJobId = crypto.randomUUID();
      const tasksTotal = perspectives.length;

      // Upload product image to storage
      const { bytes: hdBytes, contentType: hdContentType, ext: hdExt } = dataUrlToBytes(productImage!);
      const hdProductPath = `jobs/${homeDecorJobId}/product.${hdExt}`;
      const { error: hdUploadErr } = await adminClient!.storage.from(STORAGE_BUCKET).upload(hdProductPath, hdBytes, { contentType: hdContentType, upsert: true });
      if (hdUploadErr) {
        console.error("[HOME DECOR] Product upload error:", hdUploadErr);
        return new Response(JSON.stringify({ error: "Failed to store product image" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Create job with pending status
      const { error: hdJobErr } = await adminClient!.from("generation_jobs").insert({
        id: homeDecorJobId, user_id: user.id, status: "running", niche: "homeDecor",
        tasks_total: tasksTotal, tasks_done: 0, tasks_failed: 0, provider_id: ENGINE,
        config: { backgroundColor, primaryPlacement, secondaryPlacement, perspectives, resolution, product_path: hdProductPath, model_engine: resolution === "2K" ? HD_ENGINE : ENGINE },
      });
      if (hdJobErr) {
        console.error("[HOME DECOR] Failed to create job:", hdJobErr);
        return new Response(JSON.stringify({ error: "Database error creating job" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create tasks as PENDING (not running)
      const taskRows = perspectives.map((perspective) => ({
        job_id: homeDecorJobId, view_key: perspective, view_name: VIEW_NAME_MAP[perspective] || perspective,
        variant_key: "original", variant_name: "Original", task_seed: crypto.randomUUID(),
        status: "pending", is_base: perspective === "fullProduct",
      }));
      const { error: hdTaskErr } = await adminClient!.from("generation_tasks").insert(taskRows);
      if (hdTaskErr) console.error("[HOME DECOR] Failed to create tasks:", hdTaskErr);

      console.log(`[HOME DECOR] Created job ${homeDecorJobId} with ${tasksTotal} pending tasks`);

      return new Response(
        JSON.stringify({ jobId: homeDecorJobId, tasksTotal }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Invalid request configuration" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[ERROR] Unhandled:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
