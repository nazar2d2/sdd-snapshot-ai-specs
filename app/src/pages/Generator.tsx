import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { NicheSelection } from "@/components/NicheSelection";
import { FashionFlow, FashionFormData } from "@/components/FashionFlow";
import { HomeDecorFlow, HomeDecorFormData } from "@/components/HomeDecorFlow";
import { ImageResults } from "@/components/ImageResults";
import { FlowBreadcrumb } from "@/components/FlowBreadcrumb";
import { LoadingState } from "@/components/LoadingState";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { extractPathFromUrl, useSignedUrls } from "@/integrations/supabase/hooks/useUserImages";
import { invokeEdgeFunctionWithRetry } from "@/lib/invokeEdgeFunctionWithRetry";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

type Niche = "fashion" | "homeDecor" | null;
type Step = "niche" | "configure" | "loading" | "results";

interface ImageResult {
  view: string;
  viewId: string;
  variantName: string;
  image: string | null;
  error: string | null;
  taskId?: string;
  jobId?: string;
}

interface GenerationMetadata {
  niche: Niche;
  gender?: "male" | "female";
  ethnicity?: string;
  skinTone?: string;
  backgroundColor?: string;
  modelAge?: number;
  city?: string;
  productImage?: string;
  aspectRatio?: string;
  productType?: string;
  viewPose?: string;
  season?: string;
  resolution?: string;
  // Ordered variant list: BASE first, then user variants in UI order
  colorVariants?: Array<{ color: string; name: string; isBase?: boolean }>;
  // Selected views with id and name for stable ordering
  selectedViews?: Array<{ id: string; name: string }>;
  selectedViewIds?: string[];
  // Expected total images for proper tracking
  expectedTotal?: number;
}

export default function Generator() {
  const [niche, setNiche] = useState<Niche>(null);
  const [step, setStep] = useState<Step>("niche");
  const [fashionStep, setFashionStep] = useState<number>(1);
  const [homeDecorStep, setHomeDecorStep] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [images, setImages] = useState<ImageResult[]>([]);
  const [loadingCount, setLoadingCount] = useState(0);
  const [expectedTotal, setExpectedTotal] = useState(0);
  const [progressCount, setProgressCount] = useState(0);
  const [loadingHint, setLoadingHint] = useState<string | null>(null);
  const [partialImages, setPartialImages] = useState<ImageResult[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const generationMetadataRef = useRef<GenerationMetadata | null>(null);
 const workBatchSizeRef = useRef<number>(1); // CRITICAL: Must be 1 to prevent WORKER_LIMIT errors
  const lastWorkToastAtRef = useRef<number>(0);
  const lastProgressAtRef = useRef<number>(Date.now());
  const lastProgressCountRef = useRef<number>(0);
  const lastJobUpdatedAtRef = useRef<string | null>(null);
  const partialImagesRef = useRef<ImageResult[]>([]); // Track partial results
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // IMG-02: Sign result_url storage paths before display
  const displayImages = images.length > 0 ? images : partialImages;
  const imagePaths = useMemo(() => {
    const paths: string[] = [];
    for (const img of displayImages) {
      if (img.image) {
        const p = extractPathFromUrl(img.image);
        if (p) paths.push(p);
      }
    }
    return [...new Set(paths)];
  }, [displayImages]);

  const { signedMap } = useSignedUrls(imagePaths);

  const resolveImageUrl = useCallback((url: string | null): string | null => {
    if (!url) return null;
    const p = extractPathFromUrl(url);
    if (p) return signedMap[p] ?? null; // null = not yet signed; caller shows skeleton
    return url; // non-storage URL (external), safe to use directly
  }, [signedMap]);

  const handleNicheSelect = (selectedNiche: Niche) => {
    setNiche(selectedNiche);
    if (selectedNiche) {
      setStep("configure");
      if (selectedNiche === "fashion") setFashionStep(1);
      if (selectedNiche === "homeDecor") setHomeDecorStep(1);
    }
  };

  const handleBack = () => {
    if (step === "configure") {
      setStep("niche");
      setNiche(null);
    } else if (step === "results") {
      setStep("configure");
      setImages([]);
    }
  };

  const handleReset = () => {
    setStep("niche");
    setNiche(null);
    setImages([]);
    setIsGenerating(false);
    setActiveJobId(null);
    setExpectedTotal(0);
  };

  // Resume generation removed - users start fresh each time

  // Poll + advance durable jobs with PARALLEL WORKERS for ~3x faster generation
  // Each worker independently invokes the edge function for 1 task at a time

  useEffect(() => {
    if (step !== "loading" || !activeJobId) return;

    // Reduce workers for HD/2K jobs to avoid race conditions and 429s
    const meta = generationMetadataRef.current;
    const isHdJob = meta?.resolution === "2K";
    const isHomeDecor = meta?.niche === "homeDecor";
    // Home decor 2K: 1 worker to avoid colliding heavy renders
    // Other HD: 2 workers, standard: 3 workers
    const PARALLEL_WORKERS = isHdJob ? 1 : 3;

    let cancelled = false;
    const workerTimeouts: Array<ReturnType<typeof setTimeout> | null> = Array(PARALLEL_WORKERS).fill(null);

    // Reset partial images for new job
    partialImagesRef.current = [];
    setPartialImages([]);
    setProgressCount(0);
    setLoadingHint(null);

    // (Re)initialize stall detection for this job
    lastProgressAtRef.current = Date.now();
    lastProgressCountRef.current = 0;

    const MAX_STALL_MS = isHdJob ? 10 * 60 * 1000 : 5 * 60 * 1000;

    const stopAsStalled = (reason: string) => {
      if (cancelled) return;
      cancelled = true;

      // Show partial results if any images completed
      const currentPartials = partialImagesRef.current;
      const hasPartialResults = currentPartials.some(p => p.image);

      if (hasPartialResults) {
        toast({
          title: "Some images couldn't be generated",
          description: "Showing the images that completed successfully.",
          variant: "destructive",
        });
        const finalImages: ImageResult[] = currentPartials.map(p => ({
          view: p.view,
          viewId: p.viewId,
          variantName: p.variantName,
          image: p.image,
          error: p.image ? null : "Generation timed out",
        }));
        setImages(finalImages);
        setIsGenerating(false);
        setActiveJobId(null);
        setStep("results");
      } else {
        toast({
          title: "Generation stopped",
          description: reason,
          variant: "destructive",
        });
        setIsGenerating(false);
        setActiveJobId(null);
        setStep("configure");
      }
    };

    const sortAndDedupTasks = (tasks: Array<{ view_key: string; view_name: string; variant_name: string | null; result_url: string | null; created_at?: string }>) => {
      const viewOrder = ["front", "outdoor", "side", "back"];
      const variantOrder = ["Original", ...(generationMetadataRef.current?.colorVariants?.filter(v => !v.isBase).map(v => v.name) || [])];
      const selectedVariantNames = new Set(variantOrder);

      const filteredTasks = tasks.filter(t => {
        const varName = t.variant_name || "Original";
        return selectedVariantNames.has(varName);
      });

      const taskMap = new Map<string, typeof tasks[0]>();
      for (const t of filteredTasks) {
        const key = `${t.view_key}|${t.variant_name || "Original"}`;
        const existing = taskMap.get(key);
        if (!existing) {
          taskMap.set(key, t);
        } else if (t.created_at && existing.created_at && t.created_at > existing.created_at) {
          taskMap.set(key, t);
        }
      }
      const uniqueTasks = Array.from(taskMap.values());

      return uniqueTasks.sort((a, b) => {
        const viewAIdx = viewOrder.indexOf(a.view_key?.toLowerCase() || "");
        const viewBIdx = viewOrder.indexOf(b.view_key?.toLowerCase() || "");
        const viewAOrder = viewAIdx >= 0 ? viewAIdx : 99;
        const viewBOrder = viewBIdx >= 0 ? viewBIdx : 99;
        if (viewAOrder !== viewBOrder) return viewAOrder - viewBOrder;
        const varA = a.variant_name || "Original";
        const varB = b.variant_name || "Original";
        if (varA === "Original") return -1;
        if (varB === "Original") return 1;
        const varAIdx = variantOrder.indexOf(varA);
        const varBIdx = variantOrder.indexOf(varB);
        if (varAIdx >= 0 && varBIdx >= 0) return varAIdx - varBIdx;
        if (varAIdx >= 0) return -1;
        if (varBIdx >= 0) return 1;
        return varA.localeCompare(varB);
      });
    };

    const updatePartialResults = async () => {
      try {
        const { data: tasks } = await supabase
          .from("generation_tasks")
          .select("id, view_key, view_name, variant_name, result_url, created_at")
          .eq("job_id", activeJobId)
          .is("parent_task_id", null)
          .not("result_url", "is", null);

        if (tasks) {
          const prevUrls = new Set(partialImagesRef.current.map(img => img.image).filter(Boolean));
          const hasNewResults = tasks.some(t => t.result_url && !prevUrls.has(t.result_url));
          if (tasks.length !== partialImagesRef.current.length || hasNewResults) {
            const sortedTasks = sortAndDedupTasks(tasks);
            const newImages: ImageResult[] = sortedTasks.map((t) => ({
              viewId: t.view_key,
              variantName: t.variant_name || "Original",
              view: `${t.view_name}${t.variant_name && t.variant_name !== "Original" ? ` (${t.variant_name})` : ""}`,
              image: t.result_url,
              error: null,
            }));
            partialImagesRef.current = newImages;
            setPartialImages(newImages);
          }
        }
      } catch {
        // Non-critical
      }
    };

    // Shared job status check — only first worker to see "done" finalizes
    const checkJobAndUpdate = async (): Promise<"continue" | "done" | "stalled"> => {
      const { data: job, error: jobErr } = await supabase
        .from("generation_jobs")
        .select("id, status, tasks_total, tasks_done, tasks_failed, updated_at")
        .eq("id", activeJobId)
        .maybeSingle();

      if (jobErr || !job) return "continue";

      setLoadingCount(job.tasks_total || 0);
      setProgressCount((job.tasks_done || 0) + (job.tasks_failed || 0));

      // Track updated_at for reference but do NOT reset stall timer on heartbeat alone
      const jobUpdatedAt = (job as any)?.updated_at as string | undefined;
      if (jobUpdatedAt && jobUpdatedAt !== lastJobUpdatedAtRef.current) {
        lastJobUpdatedAtRef.current = jobUpdatedAt;
        // Only reset stall timer when actual progress happens (below), not on every DB heartbeat
      }

      const progressCount = (job.tasks_done || 0) + (job.tasks_failed || 0);
      if (progressCount !== lastProgressCountRef.current) {
        lastProgressCountRef.current = progressCount;
        lastProgressAtRef.current = Date.now();
        await updatePartialResults();
        queryClient.invalidateQueries({ queryKey: ["profile-credits"] });
      } else if (Date.now() - lastProgressAtRef.current > MAX_STALL_MS) {
        return "stalled";
      }

      if (job.status === "done" || job.status === "failed") {
        if (cancelled) return "done";
        cancelled = true;

        const { data: tasks, error: tasksErr } = await supabase
          .from("generation_tasks")
          .select("id, view_key, view_name, variant_name, result_url, status, last_error, created_at")
          .eq("job_id", activeJobId)
          .is("parent_task_id", null);

        if (tasksErr) return "done";

        const viewOrder = ["front", "outdoor", "side", "back"];
        const variantOrder = Array.from(new Set(["Original", ...(generationMetadataRef.current?.colorVariants?.filter(v => !v.isBase).map(v => v.name) || [])]));
        const selectedViews = generationMetadataRef.current?.selectedViews || [];

        const taskMap = new Map<string, typeof tasks[0]>();
        for (const t of (tasks || [])) {
          const key = `${t.view_key}|${t.variant_name || "Original"}`;
          const existing = taskMap.get(key);
          if (!existing || (t.result_url && !existing.result_url) || (t.created_at && existing.created_at && t.created_at > existing.created_at)) {
            taskMap.set(key, t);
          }
        }

        const nextImages: ImageResult[] = [];
        for (const view of selectedViews.sort((a, b) => {
          const aIdx = viewOrder.indexOf(a.id.toLowerCase());
          const bIdx = viewOrder.indexOf(b.id.toLowerCase());
          return (aIdx >= 0 ? aIdx : 99) - (bIdx >= 0 ? bIdx : 99);
        })) {
          for (const variantName of variantOrder) {
            const key = `${view.id}|${variantName}`;
            const task = taskMap.get(key);
            nextImages.push({
              viewId: view.id,
              variantName,
              view: `${view.name}${variantName !== "Original" ? ` (${variantName})` : ""}`,
              image: task?.result_url || null,
              error: task?.result_url ? null : (task?.last_error || (task?.status === "failed" ? "Generation failed" : "Missing result")),
              taskId: (task as any)?.id,
              jobId: activeJobId,
            });
          }
        }

        setImages(nextImages);
        setStep("results");
        setIsGenerating(false);
        setActiveJobId(null);

        const successCount = nextImages.filter(img => img.image).length;
        const failedCount = nextImages.filter(img => !img.image).length;
        if (failedCount > 0 && successCount > 0) {
          toast({ title: "Partial success", description: `${successCount} of ${nextImages.length} images generated. ${failedCount} image(s) failed — you can start over to retry.` });
        } else if (failedCount > 0 && successCount === 0) {
          toast({ title: "Generation failed", description: "All images failed to generate. Please try again.", variant: "destructive" });
        }

        return "done";
      }

      return "continue";
    };

    // Each worker runs an independent loop, processing 1 task per call
    const createWorker = (workerId: number) => {
      const workerTick = async () => {
        if (cancelled) return;

        try {
          const { data: workData, error: workErr } = await invokeEdgeFunctionWithRetry("generate-image", {
            body: {
              action: "work",
              jobId: activeJobId,
              batchSize: workBatchSizeRef.current,
            },
          });

          if (cancelled) return;

            if (workErr) {
            const e = workErr as any;
            const status = e?.context?.status as number | undefined;
            const errMsg = typeof e?.message === "string" ? e.message : "";

            // Detect permanent provider config errors — stop immediately
            const isProviderConfigError = errMsg.includes("PROVIDER_CONFIG_ERROR") || errMsg.includes("billing");
            if (isProviderConfigError) {
              stopAsStalled("Image provider is temporarily unavailable (billing/configuration issue). Please contact support.");
              return;
            }

            if (Date.now() - lastProgressAtRef.current > MAX_STALL_MS) {
              stopAsStalled("Generation appears stuck (repeated retries). Please try again.");
              return;
            }

            const now = Date.now();
            if (now - lastWorkToastAtRef.current > 12000) {
              lastWorkToastAtRef.current = now;
              toast({
                title: "Generation is retrying",
                description:
                  status === 429
                    ? "Provider rate limit hit. Retrying automatically…"
                    : status === 402
                      ? "AI credits required to continue generation."
                      : "A temporary error occurred. Retrying automatically…",
              });
            }

            if (!cancelled) {
              // Longer backoff after errors to reduce thundering herd on rate-limited provider
              const errorDelay = status === 429 ? 4000 + workerId * 500 : 2000 + workerId * 300;
              workerTimeouts[workerId] = setTimeout(workerTick, errorDelay);
            }
            return;
          }

          if (workData && typeof workData === "object") {
            const wd = workData as Record<string, unknown>;
            if (wd.status === "anchor_pending") {
              const ms = typeof wd.retryAfterMs === "number" ? wd.retryAfterMs : 3000;
              setLoadingHint("Generating your anchor image first…");
              if (!cancelled) {
                workerTimeouts[workerId] = setTimeout(workerTick, Math.max(500, ms) + workerId * 100);
              }
              return;
            }
          }

          setLoadingHint(null);

          const result = await checkJobAndUpdate();
          if (result === "stalled") {
            stopAsStalled("Generation made no progress for over 4 minutes. Please try again.");
            return;
          }
          if (result === "done" || cancelled) return;

          if (!cancelled) {
            // Use a longer delay so stale task recovery in the backend has time to run
            workerTimeouts[workerId] = setTimeout(workerTick, 1500 + workerId * 300);
          }
        } catch {
          if (!cancelled) {
            workerTimeouts[workerId] = setTimeout(workerTick, 300 + workerId * 100);
          }
        }
      };
      return workerTick;
    };

    // Launch workers with slight stagger to avoid thundering herd
    for (let i = 0; i < PARALLEL_WORKERS; i++) {
      workerTimeouts[i] = setTimeout(createWorker(i), i * 200);
    }

    return () => {
      cancelled = true;
      for (const t of workerTimeouts) {
        if (t) clearTimeout(t);
      }
    };
  }, [step, activeJobId, toast]);



  const handleFashionGenerate = async (data: FashionFormData) => {
    // Refresh the session first to ensure we have a valid token
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError || !refreshData.session?.access_token) {
      // If refresh fails, try getting current session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast({
          title: "Not logged in",
          description: "Your session has expired. Please log in again to generate.",
          variant: "destructive",
        });
        navigate("/auth", { replace: true });
        return;
      }
    }

    // Store ALL generation metadata for fix image feature (full FashionFormData)
    // Ordered variant list: BASE first, then user variants in UI order
    const orderedVariants: Array<{ color: string; name: string; isBase: boolean }> = [
      { color: "", name: "Original", isBase: true },
      ...(data.colorVariants?.filter(v => !v.isBase)?.map(v => ({ color: v.color, name: v.name, isBase: false })) || []),
    ];

    // Calculate expectedTotal: views × (base + additional variants)
    const variantCount = (data.colorVariants?.filter(v => !v.isBase)?.length || 0) + 1;
    const calculatedExpectedTotal = (data.views.length || 0) * variantCount;

    generationMetadataRef.current = {
      niche: "fashion",
      gender: data.gender,
      ethnicity: data.ethnicity,
      skinTone: data.skinTone,
      backgroundColor: data.backgroundColor,
      modelAge: data.modelAge,
      city: data.city,
      productImage: data.productImage,
      aspectRatio: data.aspectRatio || "1:1",
      productType: data.productType,
      viewPose: data.viewPose,
      season: data.season,
      resolution: data.resolution || "1K",
      colorVariants: orderedVariants,
      // Selected views with id and name
      selectedViews: data.views.map(v => ({ id: v.id, name: v.name })),
      selectedViewIds: data.views.map(v => v.id),
      // Expected total for proper tracking
      expectedTotal: calculatedExpectedTotal,
    };

    setIsGenerating(true);
    setLoadingCount(calculatedExpectedTotal);
    setExpectedTotal(calculatedExpectedTotal);
    setPartialImages([]);
    setProgressCount(0);
    setStep("loading");

    // Transform views to include custom poses/prompts for the backend function
    const viewsPayload = data.views.map((v) => ({
      id: v.id,
      name: v.name,
      pose: v.pose,
      customPrompt: v.customPrompt,
    }));

    // Transform color variants for the backend function
    const colorVariantsPayload =
      data.colorVariants
        ?.filter((v) => !v.isBase)
        ?.map((v) => ({
          color: v.color,
          name: v.name,
        })) || [];

    const invokeGeneration = async (viewsBatch: typeof viewsPayload) => {
      const { data: result, error } = await invokeEdgeFunctionWithRetry("generate-image", {
        body: {
          action: "start",
          niche: "fashion",
          productImage: data.productImage,
          views: viewsBatch,
          backgroundColor: data.backgroundColor,
          city: data.city,
          modelAge: data.modelAge,
          aspectRatio: data.aspectRatio || "1:1",
          colorVariants: colorVariantsPayload,
          gender: data.gender,
          ethnicity: data.ethnicity,
          skinTone: data.skinTone,
          productType: data.productType,
          viewPose: data.viewPose,
          season: data.season,
          resolution: data.resolution || "1K",
        },
      });

      if (error) {
        console.error("Edge function error:", error);
        throw new Error((error as any)?.message || "Failed to start generation");
      }

      return result;
    };

    try {
      // Start a durable job (backend will process in small "work" chunks)
      const result = await invokeGeneration(viewsPayload);

      const jobId = result?.jobId as string | undefined;
      const totalExpected = variantCount * viewsPayload.length;

      if (!jobId) {
        throw new Error("Failed to start generation job");
      }

      setLoadingCount(result?.tasksTotal ?? totalExpected);
      setActiveJobId(jobId);
      // Stay on loading; useEffect will poll until DONE, then show results.
    } catch (error) {
      console.error("Generation error:", error);
      const message = error instanceof Error ? error.message : "An error occurred while generating images.";
      toast({
        title: "Could not start generation",
        description: message,
        variant: "destructive",
      });
      setStep("configure");
      setIsGenerating(false);
    }
  };

  const handleHomeDecorGenerate = async (data: HomeDecorFormData) => {
    // Refresh the session first to ensure we have a valid token
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError || !refreshData.session?.access_token) {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast({
          title: "Not logged in",
          description: "Your session has expired. Please log in again to generate.",
          variant: "destructive",
        });
        navigate("/auth", { replace: true });
        return;
      }
    }

    const totalImages = data.perspectives.length;

    // Store metadata for the polling/results flow
    generationMetadataRef.current = {
      niche: "homeDecor",
      backgroundColor: data.backgroundColor,
      productImage: data.productImage,
      aspectRatio: "1:1",
      resolution: data.resolution || "1K",
      selectedViews: data.perspectives.map(p => ({
        id: p,
        name: p === "fullProduct" ? "Full Product" : p === "lifestylePrimary" ? "Lifestyle Primary" : p === "lifestyleSecondary" ? "Lifestyle Secondary" : p,
      })),
      selectedViewIds: data.perspectives,
      colorVariants: [{ color: "", name: "Original", isBase: true }],
      expectedTotal: totalImages,
    };

    setIsGenerating(true);
    setLoadingCount(totalImages);
    setExpectedTotal(totalImages);
    setPartialImages([]);
    setProgressCount(0);
    setStep("loading");

    try {
      const { data: result, error } = await invokeEdgeFunctionWithRetry("generate-image", {
        body: {
          action: "start",
          niche: "homeDecor",
          productImage: data.productImage,
          perspectives: data.perspectives,
          aspectRatio: "1:1",
          backgroundColor: data.backgroundColor,
          primaryPlacement: data.primaryPlacement,
          secondaryPlacement: data.secondaryPlacement,
          resolution: data.resolution || "1K",
        },
      });

      if (error) {
        console.error("Edge function error:", error);
        throw new Error((error as any)?.message || "Failed to start generation");
      }

      const jobId = result?.jobId as string | undefined;
      if (!jobId) {
        throw new Error("Failed to start generation job");
      }

      setLoadingCount(result?.tasksTotal ?? totalImages);
      setActiveJobId(jobId);
      // useEffect polling will handle the rest
    } catch (error) {
      console.error("Generation error:", error);
      const message = error instanceof Error ? error.message : "An error occurred while generating images.";
      toast({
        title: "Could not start generation",
        description: message,
        variant: "destructive",
      });
      setStep("configure");
      setIsGenerating(false);
    }
  };

  const handleFixImage = async (imageData: {
    view: string;
    originalImage: string;
    fixInstruction: string;
    metadata?: Record<string, unknown>;
  }): Promise<string | null> => {
    try {
      // Ensure we have a fresh/valid session token for the backend call
      const { data: refreshData } = await supabase.auth.refreshSession();
      const refreshedSession = refreshData.session;

      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      const session = refreshedSession ?? currentSession;

      if (!session?.access_token) {
        toast({
          title: "Not logged in",
          description: "Your session has expired. Please log in again to fix images.",
          variant: "destructive",
        });
        navigate("/auth", { replace: true });
        return null;
      }

      const metadataToSend = imageData.metadata ?? generationMetadataRef.current ?? undefined;

      const originalTaskId = (metadataToSend as any)?.originalTaskId;
      const { data: result, error } = await supabase.functions.invoke("fix-image", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          view: imageData.view,
          originalImage: imageData.originalImage,
          fixInstruction: imageData.fixInstruction,
          ...(metadataToSend ? { metadata: metadataToSend } : {}),
          ...(originalTaskId ? { originalTaskId } : {}),
        },
      });

      if (error) {
        const anyErr = error as unknown as {
          message?: string;
          context?: { status?: number; body?: unknown };
        };

        let details = anyErr?.message || "Failed to fix image";
        const status = anyErr?.context?.status;
        const body = anyErr?.context?.body;

        if (typeof body === "string") {
          try {
            const parsed = JSON.parse(body);
            if (parsed?.error) details = String(parsed.error);
          } catch {
            // keep default
          }
        } else if (body && typeof body === "object" && "error" in (body as any)) {
          details = String((body as any).error);
        }

        console.error("Fix image error:", { status, details, raw: anyErr });
        toast({
          title: "Fix Failed",
          description: status ? `${details} (HTTP ${status})` : details,
          variant: "destructive",
        });
        return null;
      }

      if (!result?.image) {
        toast({
          title: "Fix Failed",
          description: "No image was generated",
          variant: "destructive",
        });
        return null;
      }

      toast({
        title: "Image Fixed",
        description: "Your image has been regenerated with the requested fix.",
        variant: "success",
      });

      return result.image;
    } catch (error) {
      console.error("Fix image error:", error);
      toast({
        title: "Fix Failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      return null;
    }
  };

  return (
    <div className="flex flex-col min-h-full w-full">
      <div className="w-full px-3 sm:px-6 lg:px-8 pt-3 sm:pt-6">
        <div className="flex items-center justify-between gap-4 min-h-[28px]">
          {step !== "niche" && step !== "loading" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="flex items-center gap-1.5 text-muted-foreground/80 hover:text-foreground -ml-2 text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Button>
          ) : (
            <span />
          )}
          <div className="flex-1" />
          <FlowBreadcrumb step={step} niche={niche} fashionStep={niche === "fashion" ? fashionStep : undefined} homeDecorStep={niche === "homeDecor" ? homeDecorStep : undefined} />
        </div>
      </div>

      <div className="w-full px-3 sm:px-6 lg:px-8 py-3 sm:py-6 flex-1 flex flex-col min-h-0">
        {step === "niche" && (
          <NicheSelection
            selectedNiche={niche}
            onSelectNiche={handleNicheSelect}
          />
        )}

        {step === "configure" && niche === "fashion" && (
          <FashionFlow onGenerate={handleFashionGenerate} isGenerating={isGenerating} onStepChange={setFashionStep} />
        )}

        {step === "configure" && niche === "homeDecor" && (
          <HomeDecorFlow onGenerate={handleHomeDecorGenerate} isGenerating={isGenerating} onStepChange={setHomeDecorStep} />
        )}

        {step === "loading" && (
          <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0">
            <LoadingState
              count={expectedTotal || loadingCount}
              progress={progressCount}
              partialImages={partialImages.map(img => ({ ...img, image: resolveImageUrl(img.image) }))}
              message={loadingHint ?? undefined}
            />
          </div>
        )}

        {step === "results" && (
          <div className="flex-1 flex flex-col items-center w-full min-h-0">
            <ImageResults
              images={images.map(img => ({ ...img, image: resolveImageUrl(img.image) }))}
              onReset={handleReset}
              onFixImage={handleFixImage}
              generationMetadata={generationMetadataRef.current ? { ...generationMetadataRef.current, expectedTotal } : undefined}
              expectedTotal={expectedTotal}
              onRetryMissing={async (jobId: string) => {
                // Call reconcile to reset failed tasks, then re-enter loading
                const { error } = await invokeEdgeFunctionWithRetry("generate-image", {
                  body: { action: "reconcile", jobId },
                });
                if (error) {
                  toast({ title: "Retry failed", description: "Could not restart missing images.", variant: "destructive" });
                  return;
                }
                setActiveJobId(jobId);
                setStep("loading");
                setIsGenerating(true);
                setProgressCount(0);
                lastProgressAtRef.current = Date.now();
                lastProgressCountRef.current = 0;
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
