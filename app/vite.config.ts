import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/** Last-resort defaults if env is missing (prefer setting VITE_SUPABASE_URL + key from one project). */
const FALLBACK_URL = "https://phkwivrcuuvzpgzvvmkv.supabase.co";
const FALLBACK_REF = "phkwivrcuuvzpgzvvmkv";

function parseRefFromSupabaseUrl(url: string): string | null {
  const m = url
    .trim()
    .replace(/\/$/, "")
    .match(/https:\/\/([a-z0-9-]+)\.supabase\.co$/i);
  return m?.[1] ?? null;
}

/** Decode `ref` from Supabase anon JWT; return null for sb_publishable_ / non-JWT keys. */
function jwtProjectRef(anonKey: string): string | null {
  const parts = anonKey.trim().split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
    const json = Buffer.from(pad, "base64").toString("utf8");
    const payload = JSON.parse(json) as { ref?: string };
    return typeof payload.ref === "string" ? payload.ref : null;
  } catch {
    return null;
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const url = (env.VITE_SUPABASE_URL || FALLBACK_URL).trim().replace(/\/$/, "");
  const refFromUrl = parseRefFromSupabaseUrl(url);
  const projectRef = (refFromUrl || env.VITE_SUPABASE_PROJECT_ID?.trim() || FALLBACK_REF).trim();

  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  const keyRef = jwtProjectRef(key);
  if (keyRef && refFromUrl && keyRef !== refFromUrl) {
    console.warn(
      `\n[snapshot] VITE_SUPABASE_PUBLISHABLE_KEY is for project "${keyRef}" but VITE_SUPABASE_URL is "${url}". ` +
        `Use the anon key from that same project, or change VITE_SUPABASE_URL to https://${keyRef}.supabase.co\n`
    );
  }

  return {
    server: {
      host: "::",
      port: 8080,
    },
    preview: {
      host: "::",
      port: 8080,
      strictPort: true,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      __SNAPSHOT_SUPABASE_BUILD_URL__: JSON.stringify(url),
      __SNAPSHOT_SUPABASE_BUILD_REF__: JSON.stringify(projectRef),
    },
  };
});
