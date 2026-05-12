/**
 * Shared CORS headers for admin Edge Functions.
 * Uses SITE_URL as the only allowed origin (no wildcard).
 */
const DEFAULT_ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

export function buildCorsHeaders(): Record<string, string> {
  const siteUrl = Deno.env.get("SITE_URL")?.trim();
  if (!siteUrl) {
    console.warn(
      "SITE_URL is not set; CORS allow-origin is \"null\" (browser will deny cross-origin).",
    );
    return {
      "Access-Control-Allow-Origin": "null",
      "Access-Control-Allow-Headers": DEFAULT_ALLOW_HEADERS,
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE, PATCH",
    };
  }
  return {
    "Access-Control-Allow-Origin": siteUrl,
    "Access-Control-Allow-Headers": DEFAULT_ALLOW_HEADERS,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE, PATCH",
  };
}
