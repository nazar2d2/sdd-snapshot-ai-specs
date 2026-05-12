import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function supabaseJwtProjectRef(anonKey: string): string | null {
  const parts = anonKey.trim().split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
    const json = atob(padded);
    const payload = JSON.parse(json) as { ref?: string };
    return typeof payload.ref === "string" ? payload.ref : null;
  } catch {
    return null;
  }
}

function parseRefFromSupabaseUrl(url: string): string | null {
  const m = url
    .trim()
    .replace(/\/$/, "")
    .match(/https:\/\/([a-z0-9-]+)\.supabase\.co$/i);
  return m?.[1] ?? null;
}

// URL/ref from vite `define` (see vite.config loadEnv / VITE_SUPABASE_URL).
const SUPABASE_URL = __SNAPSHOT_SUPABASE_BUILD_URL__;
const PROJECT_REF = __SNAPSHOT_SUPABASE_BUILD_REF__;

const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!SUPABASE_PUBLISHABLE_KEY?.trim()) {
  throw new Error(
    "Missing VITE_SUPABASE_PUBLISHABLE_KEY. Use the Supabase anon/public key (same project as the app URL). For Docker: pass build-arg from .env or CI secrets."
  );
}

const urlRef = parseRefFromSupabaseUrl(SUPABASE_URL);
const keyRef = supabaseJwtProjectRef(SUPABASE_PUBLISHABLE_KEY);
if (keyRef && urlRef && keyRef !== urlRef) {
  throw new Error(
    `Supabase anon key is for project "${keyRef}" but API URL is "${SUPABASE_URL}" (expected ref "${urlRef}"). Align VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the same Supabase project.`
  );
}

if (typeof window !== "undefined") {
  const w = window as Window & {
    __SNAPSHOT_SUPABASE_PROJECT_REF__?: string;
    __SNAPSHOT_SUPABASE_URL__?: string;
  };
  w.__SNAPSHOT_SUPABASE_PROJECT_REF__ = PROJECT_REF;
  w.__SNAPSHOT_SUPABASE_URL__ = SUPABASE_URL;
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storageKey: `sb-${PROJECT_REF}-auth`,
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
