import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { falGenerateImage } from "../_shared/fal-adapter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Format specification for aspect ratio enforcement (MUST MATCH generate-image)
interface FormatSpec {
  aspect: string;
  width: number;
  height: number;
  promptDirective: string;
}

// FORMAT LOCK: Target pixel dimensions per aspect ratio
// Per spec: 1:1 -> 1024x1024, 4:5 -> 1024x1280, 9:16 -> 1080x1920
const FORMAT_SPECS: Record<string, FormatSpec> = {
  "1:1": {
    aspect: "1:1",
    width: 1024,
    height: 1024,
    promptDirective: "STRICT SQUARE 1:1 FORMAT - exactly 1024x1024 pixels.",
  },
  "4:5": {
    aspect: "4:5",
    width: 1024,
    height: 1280,
    promptDirective: "STRICT PORTRAIT 4:5 FORMAT - exactly 1024x1280 pixels.",
  },
  "9:16": {
    aspect: "9:16",
    width: 1080,
    height: 1920,
    promptDirective: "STRICT TALL PORTRAIT 9:16 FORMAT - exactly 1080x1920 pixels.",
  },
};

function getFormatSpec(aspectRatio: string): FormatSpec {
  const spec = FORMAT_SPECS[aspectRatio];
  if (!spec) {
    console.error(`[FORMATLOCK] Invalid aspect ratio "${aspectRatio}", falling back to 1:1`);
    return FORMAT_SPECS["1:1"];
  }
  return spec;
}

const FixImageRequestSchema = z.object({
  view: z.string(),
  originalImage: z.string(),
  fixInstruction: z.string().min(1, "Fix instruction is required"),
  jobId: z.string().uuid().optional(), // Required for job-bound validation
  productHash: z.string().optional(), // Required for product identity validation
  originalTaskId: z.string().uuid().optional(), // Links fixed version to original task
  metadata: z
    .object({
      niche: z.enum(["fashion", "homeDecor"]).optional(),
      gender: z.enum(["male", "female"]).optional(),
      ethnicity: z.string().optional(),
      skinTone: z.string().optional(),
      backgroundColor: z.string().optional(),
      modelAge: z.number().optional(),
      city: z.string().optional(),
      productImage: z.string().optional(),
      identityAnchorImage: z.string().optional(),
      aspectRatio: z.enum(["1:1", "4:5", "9:16"]).optional(),
      productType: z.string().optional(),
      viewPose: z.string().optional(),
      season: z.string().optional(),
      jobId: z.string().uuid().optional(), // Fallback for backward compatibility
      productHash: z.string().optional(), // Fallback for backward compatibility
    })
    .optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FAL_KEY = Deno.env.get("FAL_KEY");
    if (!FAL_KEY) {
      throw new Error("FAL_KEY is not configured");
    }

    // Authenticate user
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader) {
      console.log("Fix-image: missing authorization header");
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : authHeader;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.log("Fix-image: unauthorized", { message: authError?.message });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Fix image request from user: ${user.id}`);

    const body = await req.json();
    const parseResult = FixImageRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(JSON.stringify({ error: "Invalid request", details: parseResult.error.errors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { view, originalImage, fixInstruction, jobId, productHash, metadata, originalTaskId } = parseResult.data;

    // Extract job context (supports both top-level and metadata fallback)
    const effectiveJobId = jobId || metadata?.jobId;
    const effectiveProductHash = productHash || metadata?.productHash;

    console.log(`Fixing image for view: ${view}`);
    console.log(`Fix instruction: ${fixInstruction}`);
    console.log(`Job context: jobId=${effectiveJobId || "none"}, productHash=${effectiveProductHash || "none"}`);

    // Build the fix prompt with STRICT locked attributes pipeline
    const gender = metadata?.gender || "female";
    const modelDescription =
      gender === "male"
        ? "handsome male model with well-groomed appearance, athletic build"
        : "gorgeous female model with flawless skin, natural elegant makeup";

    const hasIdentityAnchor = Boolean(metadata?.identityAnchorImage);
    const hasProductImage = Boolean(metadata?.productImage);

    // Get aspect ratio from metadata (REQUIRED for format consistency)
    const aspectRatio = metadata?.aspectRatio || "1:1";
    const formatSpec = getFormatSpec(aspectRatio);

    // Extract locked attributes from metadata
    const lockedAttributes = {
      productColor: metadata?.backgroundColor || "original from image",
      viewType: view,
      niche: metadata?.niche || "fashion",
      city: metadata?.city || "not specified",
      modelAge: metadata?.modelAge || "as shown in original",
      aspectRatio: aspectRatio,
    };

    // Detect if this is a FRAMING-ONLY request
    const framingKeywords = [
      "zoom",
      "wider",
      "closer",
      "distance",
      "frame",
      "framing",
      "crop",
      "pan",
      "include",
      "show more",
      "show less",
      "visible",
      "head",
      "feet",
      "full body",
      "half body",
      "cut off",
      "cropped",
      "camera",
      "field of view",
      "pull back",
      "move back",
      "step back",
      "further",
      "nearer",
      "tighter",
      "looser",
    ];
    const isFramingRequest = framingKeywords.some((kw) => fixInstruction.toLowerCase().includes(kw.toLowerCase()));

    const framingExtra = isFramingRequest
      ? `
FRAMING ADJUSTMENT: Only camera distance/zoom/crop changes. Garment color, design, model identity, pose, background, lighting, expression ALL stay identical to Image 1. If garment color shifts even slightly, result is INVALID.`
      : "";

    const fixPrompt = `[SURGICAL IMAGE EDITOR]
Apply ONLY the exact change requested. No other modifications.

[FORMAT] ${formatSpec.aspect} (${formatSpec.width}x${formatSpec.height}). Full-bleed, no borders. Single image, one person, one pose.

[INSTRUCTION] "${fixInstruction}"
Interpret literally. Apply this ONE change only. No creative interpretation, no "helpful" enhancements.
${framingExtra}

[FROZEN ATTRIBUTES - everything not mentioned is IMMUTABLE from Image 1]
- Aspect ratio: ${lockedAttributes.aspectRatio}
- Garment color: ${lockedAttributes.productColor} - exact shade preserved
- Garment design: buttons, pockets, stitching, pattern, fit, drape
- Model identity: exact same face, hair, skin tone, body, expression
- Model pose: stance, arm/leg position, head tilt
- Background: color, environment, lighting, shadows
- View: "${view}" camera angle
- Accessories, hair styling, grooming: unchanged

[REFERENCE IMAGES]
Image 1: SOURCE - clone everything, apply one minimal change.
${hasIdentityAnchor ? "Image 2: IDENTITY ANCHOR - face reference for consistency.\n" : ""}${hasProductImage ? `${hasIdentityAnchor ? "Image 3" : "Image 2"}: PRODUCT REFERENCE - garment color/design must match.\n` : ""}

[IDENTITY LOCK] Person 100% identical to Image 1${hasIdentityAnchor ? " (face from anchor if needed)" : ""}. Same face structure, hair, body, skin tone, expression.

[PRODUCT LOCK] Garment 100% identical. Same color shade, pattern, design, fit, drape.

[FACE PROTECTION] Full face 100% visible. Full head with 10% headroom. Never crop/erase/blur face. Face identical to Image 1.

[OUTPUT] ${modelDescription}. Ultra-realistic ecommerce quality. Sharp focus. No text/labels/codes. Pure photograph, ${formatSpec.aspect} aspect ratio.

[REJECTION TRIGGERS] Invalid if: wrong aspect ratio, face cropped/erased, color shifted, identity changed, background changed (unless requested), any locked attribute differs, collage/grid output.

EXECUTE: Apply "${fixInstruction}" only. Everything else pixel-identical to Image 1.`;

    // Prepare image inputs (order matters)
    // Image 1: source image to fix
    // Image 2: identity anchor (optional) - for face consistency
    // Image 3: product reference (optional) - for garment consistency
    const imageInputs: Array<{ type: string; image_url: { url: string } }> = [
      {
        type: "image_url",
        image_url: { url: originalImage },
      },
    ];

    if (metadata?.identityAnchorImage) {
      imageInputs.push({
        type: "image_url",
        image_url: { url: metadata.identityAnchorImage },
      });
    }

    if (metadata?.productImage) {
      imageInputs.push({
        type: "image_url",
        image_url: { url: metadata.productImage },
      });
    }

    console.log(`Fix prompt constructed. Image inputs: ${imageInputs.length} images, aspectRatio: ${aspectRatio}`);

    // Call fal.ai Nano Banana 2 to generate the fixed image with retry logic
    const MAX_ATTEMPTS = 3;
    let generatedImageUrl: string | null = null;
    const imageUrls = imageInputs.map((i) => i.image_url.url);
    const fullPrompt =
      fixPrompt +
      "\n\nIMPORTANT: Generate the edited image directly. Do NOT respond with text or JSON - output the actual image.";
    const falAspectRatio =
      aspectRatio === "1:1" || aspectRatio === "4:5" || aspectRatio === "9:16" ? aspectRatio : "1:1";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      console.log(`[FIX-IMAGE] Attempt ${attempt}/${MAX_ATTEMPTS}`);

      const result = await falGenerateImage(fullPrompt, imageUrls, {
        aspectRatio: falAspectRatio,
        resolution: "4K",
      });

      if (result.ok) {
        generatedImageUrl = result.imageUrl;
        console.log(`[FIX-IMAGE] ✓ Image generated on attempt ${attempt}`);
        break;
      }

      console.warn(`[FIX-IMAGE] Attempt ${attempt} failed: ${result.error}`);

      if (result.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (result.status === 402) {
        return new Response(JSON.stringify({ error: "API credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    if (!generatedImageUrl) {
      console.error("[FIX-IMAGE] All attempts failed - no image generated");
      throw new Error("No image was generated after multiple attempts");
    }

    console.log(`Successfully fixed image for view: ${view}, aspectRatio: ${aspectRatio}`);

    // Upload to storage & save to DB
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let finalImageUrl = generatedImageUrl;
    let newTaskId: string | null = null;

    const adminClient = serviceKey
      ? createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

    if (adminClient) {
      const STORAGE_BUCKET = "generated-images";
      const RUN_ID = crypto.randomUUID();

      // Ensure bucket exists
      const { error: bucketError } = await adminClient.storage.createBucket(STORAGE_BUCKET, { public: false });
      if (
        bucketError &&
        !String(bucketError.message || "")
          .toLowerCase()
          .includes("already")
      ) {
        console.error("Bucket create error:", bucketError);
      }

      // Convert base64 to bytes
      const match = generatedImageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const contentType = match[1];
        const base64 = match[2];
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const ext = contentType.includes("png") ? "png" : "jpg";

        const slugify = (s: string) =>
          s
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9\-()]/g, "")
            .slice(0, 80);
        const path = `${user.id}/${RUN_ID}/fixed-${slugify(view)}.${ext}`;

        const { error: uploadError } = await adminClient.storage
          .from(STORAGE_BUCKET)
          .upload(path, bytes, { contentType, upsert: true });

        if (!uploadError) {
          const { data: signedData, error: signError } = await adminClient.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(path, 60 * 60 * 24); // 24h

          if (!signError && signedData?.signedUrl) {
            finalImageUrl = signedData.signedUrl;
          }
        } else {
          console.error("Upload error:", uploadError);
        }
      }

      // Save fixed image as a new generation_task linked to the original
      if (originalTaskId) {
        try {
          const { data: origTask } = await adminClient
            .from("generation_tasks")
            .select("job_id, view_key, view_name, variant_key, variant_name, aspect_ratio, target_width, target_height, product_hash, variant_color")
            .eq("id", originalTaskId)
            .maybeSingle();

          if (origTask) {
            const { data: inserted, error: insertErr } = await adminClient
              .from("generation_tasks")
              .insert({
                job_id: origTask.job_id,
                view_key: origTask.view_key,
                view_name: origTask.view_name,
                variant_key: `${origTask.variant_key}-fix-${crypto.randomUUID().slice(0, 8)}`,
                variant_name: origTask.variant_name,
                aspect_ratio: origTask.aspect_ratio,
                target_width: origTask.target_width,
                target_height: origTask.target_height,
                product_hash: origTask.product_hash,
                variant_color: origTask.variant_color,
                parent_task_id: originalTaskId,
                status: "done",
                result_url: finalImageUrl,
                task_seed: crypto.randomUUID(),
                is_base: false,
              })
              .select("id")
              .single();

            if (insertErr) {
              console.error("[FIX-IMAGE] Insert error:", insertErr.message, insertErr.details, insertErr.hint);
            }
            newTaskId = inserted?.id ?? null;
            console.log(`[FIX-IMAGE] Saved fixed task: ${newTaskId}, parent: ${originalTaskId}`);
          } else {
            console.warn(`[FIX-IMAGE] Original task not found: ${originalTaskId}`);
          }
        } catch (dbErr) {
          console.error("[FIX-IMAGE] Failed to save fixed task row:", dbErr);
        }
      }
    }

    return new Response(JSON.stringify({ image: finalImageUrl, view, taskId: newTaskId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Fix image error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
