#!/usr/bin/env node
/**
 * Decode SUPABASE_SERVICE_ROLE_KEY JWT (no verify) and probe Auth Admin API.
 * Use when create-test-user says "Invalid API key" but you believe the key is correct.
 *
 * Usage: node scripts/verify-supabase-credentials.mjs
 *
 * Comments in source files: English only.
 */

import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

function loadEnv() {
  const envPath = join(rootDir, ".env");
  if (!existsSync(envPath)) return {};
  const content = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

/** @param {string} jwt */
function decodePayload(jwt) {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Not a JWT (need 3 dot-separated segments)");
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const json = Buffer.from(b64 + pad, "base64").toString("utf8");
  return JSON.parse(json);
}

/** @param {string} supabaseUrl */
function refFromUrl(supabaseUrl) {
  try {
    const u = new URL(supabaseUrl);
    const host = u.hostname;
    const m = host.match(/^([^.]+)\.supabase\.co$/);
    return m ? m[1] : host;
  } catch {
    return null;
  }
}

async function main() {
  const env = { ...process.env, ...loadEnv() };
  let url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL)?.trim()?.replace(/\/$/, "") ?? "";
  let key = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (key.startsWith("yJ") && !key.startsWith("eyJ")) key = `e${key}`;

  if (!url || !key) {
    console.error("Need SUPABASE_URL or VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  console.log("URL:", url);
  console.log("Key length (chars):", key.length);
  console.log("Key prefix:", key.slice(0, 24) + "…");

  let payload;
  try {
    payload = decodePayload(key);
  } catch (e) {
    console.error("Failed to decode JWT payload:", e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const role = payload.role;
  const ref = payload.ref ?? null;
  console.log("\n--- JWT payload (safe fields) ---");
  console.log("role:", role, role === "service_role" ? "OK" : "WRONG — need service_role (anon looks the same at the start of the string!)");
  console.log("ref (project from token):", ref ?? "(missing in token)");
  const urlRef = refFromUrl(url);
  console.log("ref (from SUPABASE_URL host):", urlRef);
  if (ref && urlRef && ref !== urlRef) {
    console.error(
      "\nMISMATCH: JWT is for project ref \"" + ref + '" but URL host is "' + urlRef + '". Keys are per-project.',
    );
    const anonJwt = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || "").trim();
    try {
      if (anonJwt.split(".").length === 3) {
        const anonPayload = decodePayload(anonJwt);
        const anonRef = anonPayload.ref ?? null;
        if (anonRef === urlRef) {
          console.error(
            "\nFix: Your publishable (anon) key matches URL ref \"" +
              urlRef +
              '". Replace SUPABASE_SERVICE_ROLE_KEY with the service_role JWT from that same project (Dashboard → Project Settings → API → Project API keys → service_role). You likely pasted service_role from ref "' +
              ref +
              '".',
          );
        } else if (anonRef) {
          console.error(
            "\nFix: Publishable key ref is \"" +
              anonRef +
              "\", URL ref is \"" +
              urlRef +
              '", service_role ref is "' +
              ref +
              '". Use one project only: same URL + anon + service_role from one Dashboard project.',
          );
        }
      }
    } catch {
      // ignore anon decode errors
    }
    process.exit(1);
  }

  if (role !== "service_role") {
    console.error('\nFix: Dashboard → Settings → API → copy JWT labeled service_role — not "anon" / publishable.');
    process.exit(1);
  }

  console.log("\n--- HTTP probe: Auth Admin (same as scripts use) ---");
  const adminUrl = `${url}/auth/v1/admin/users?per_page=1`;
  const res = await fetch(adminUrl, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  const text = await res.text();
  console.log("GET /auth/v1/admin/users …", res.status, res.ok ? "OK" : "");

  if (!res.ok) {
    console.error("Body (trimmed):", text.slice(0, 400));
    process.exit(1);
  }

  console.log("\nCredential pair is valid for Auth Admin API. If create-test-user still fails, bump @supabase/supabase-js.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
