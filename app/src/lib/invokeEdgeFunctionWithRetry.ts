import { supabase } from "@/integrations/supabase/client";

type InvokeErrorLike = {
  message?: string;
  context?: {
    status?: number;
    body?: unknown;
  };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isTransientBootOrProxyFailure = (status?: number, message?: string) => {
  const transientMsg =
    !!message &&
    /(BOOT_ERROR|Function failed to start|Failed to fetch|NetworkError|Load failed|Network connection lost)/i.test(message);

  // Some environments surface network/proxy resets as a thrown TypeError("Failed to fetch")
  if (!status && transientMsg) return true;

  // Treat known infra hiccups as retryable even when surfaced as a 500.
  if (status === 500 && transientMsg) return true;

  return status === 502 || status === 503 || status === 504;
};

export async function invokeEdgeFunctionWithRetry<TData = any>(
  functionName: string,
  options: Parameters<typeof supabase.functions.invoke>[1],
  {
    retries = 2,
    baseDelayMs = 800,
  }: { retries?: number; baseDelayMs?: number } = {},
): Promise<{ data: TData | null; error: unknown | null }> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let data: unknown = null;
    let error: unknown = null;

    try {
      const res = await supabase.functions.invoke(functionName, options);
      data = res.data;
      error = res.error;
    } catch (e) {
      // Network/client-side failures can throw instead of returning { error }
      error = e;
    }

    if (!error) return { data: (data as TData) ?? null, error: null };

    const e = error as unknown as InvokeErrorLike;
    const status = e?.context?.status;
    const message = e?.message;

    lastError = error;

    if (attempt < retries && isTransientBootOrProxyFailure(status, message)) {
      // exponential-ish backoff: 800ms, 1600ms, 3200ms...
      await sleep(baseDelayMs * Math.pow(2, attempt));
      continue;
    }

    return { data: null, error };
  }

  return { data: null, error: lastError };
}
