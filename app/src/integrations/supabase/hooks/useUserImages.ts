import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserImage {
  id: string;
  result_url: string;
  view_name: string;
  variant_name: string;
  created_at: string;
  job_id: string;
  niche: string;
  job_created_at: string;
  parent_task_id: string | null;
}

/** Extract the storage path from a result_url.
 *  Handles three formats:
 *  1. Bare storage path (e.g. "jobs/{jobId}/view/variant.png") — return as-is
 *  2. Supabase signed/public URL containing "generated-images/" — extract object path after bucket name
 *  3. Other https:// URLs — return null (external, not our storage)
 */
export function extractPathFromUrl(url: string): string | null {
  if (!url) return null;
  // Bare storage path — not a URL, validate it looks like a legitimate storage path
  if (!url.startsWith("https://")) {
    if (/^[a-zA-Z0-9_\-\/\.]+$/.test(url) && url.length <= 512) return url;
    return null; // reject data: URIs, injected strings, or anything unexpected
  }
  // Supabase URL — extract path after bucket name
  const marker = "generated-images/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  let path = url.substring(idx + marker.length);
  const qIdx = path.indexOf("?");
  if (qIdx !== -1) path = path.substring(0, qIdx);
  return path || null;
}

/**
 * Phase 1: Fast metadata fetch — no URL signing.
 * Returns raw result_url values (expired signed URLs or storage paths).
 */
export function useUserImages() {
  const {
    data: images,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["user-images"],
    queryFn: async (): Promise<UserImage[]> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: tasks, error: tasksError } = await supabase
        .from("generation_tasks")
        .select(
          `
          id,
          result_url,
          view_name,
          variant_name,
          created_at,
          job_id,
          parent_task_id,
          generation_jobs!inner (
            niche,
            created_at
          )
        `
        )
        .eq("status", "done")
        .not("result_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);

      if (tasksError) {
        console.error("Error fetching user images:", tasksError);
        throw tasksError;
      }

      type TaskRow = {
        id: string;
        result_url: string;
        view_name: string;
        variant_name: string;
        created_at: string;
        job_id: string;
        parent_task_id: string | null;
        generation_jobs: { niche: string; created_at: string } | { niche: string; created_at: string }[];
      };

      return (tasks as TaskRow[] | null)?.map((t) => {
        const job = t.generation_jobs;
        const j = Array.isArray(job) ? job[0] : job;
        return {
          id: t.id,
          result_url: t.result_url,
          view_name: t.view_name,
          variant_name: t.variant_name,
          created_at: t.created_at,
          job_id: t.job_id,
          niche: j?.niche ?? "",
          job_created_at: j?.created_at ?? "",
          parent_task_id: t.parent_task_id,
        };
      }) ?? [];
    },
  });

  return {
    images: images ?? [],
    isLoading,
    error,
    refetch,
  };
}

/**
 * Phase 2: Sign only the provided storage paths.
 * Call with paths extracted from visible images only.
 */
export function useSignedUrls(paths: string[]) {
  const { data: signedMap, isLoading } = useQuery({
    queryKey: ["signed-urls", [...paths].sort().join(",")],
    queryFn: async (): Promise<Record<string, string>> => {
      if (paths.length === 0) return {};
      const { data: signedData } = await supabase.storage
        .from("generated-images")
        .createSignedUrls(paths, 3600);
      const map: Record<string, string> = {};
      if (signedData) {
        for (const item of signedData) {
          if (item.signedUrl && item.path) {
            map[item.path] = item.signedUrl;
          }
        }
      }
      return map;
    },
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000, // 50 minutes (URLs expire in 60)
  });

  return { signedMap: signedMap ?? {}, isSigningUrls: isLoading && paths.length > 0 };
}
