#!/usr/bin/env node
/**
 * Create or repair a Supabase Auth user plus profile / admin role / whitelist rows for local or staging QA.
 * If the email already exists, updates password (email_confirm) and re-applies profile + roles + whitelist.
 *
 * Requires in .env (repository root):
 *   SUPABASE_URL OR VITE_SUPABASE_URL — project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase Dashboard → Project Settings → API →
 *     section "Project API keys" → copy "service_role" (secret). Never commit or use with VITE_ prefix.
 *
 * For staging, prefer disabling mandatory email confirmation for the test project or rely on
 * email_confirm: true from this script (Admin API).
 *
 * Usage:
 *   node scripts/create-test-user.mjs
 *   node scripts/create-test-user.mjs --email=qa@test.local --password=secret123 --no-whitelist
 *
 * Comments in source files: English only.
 */

import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

/** @returns {Record<string, string>} */
function loadEnv() {
  const envPath = join(rootDir, ".env");
  if (!existsSync(envPath)) return {};
  const content = readFileSync(envPath, "utf8");
  /** @type {Record<string, string>} */
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

function parseArgs(argv) {
  /** @type {{ email: string; password: string; fullName: string; whitelist: boolean; adminRole: boolean; userId: string | null }} */
  const result = {
    email: "test2@mail.com",
    password: "SnapshotTest_1",
    fullName: "QA Test User",
    whitelist: true,
    adminRole: true,
    userId: null,
  };
  for (const a of argv) {
    if (a === "--no-whitelist") result.whitelist = false;
    if (a === "--no-admin") result.adminRole = false;
    if (a.startsWith("--email=")) result.email = a.slice("--email=".length).trim().toLowerCase();
    if (a.startsWith("--password=")) result.password = a.slice("--password=".length);
    if (a.startsWith("--name=")) result.fullName = a.slice("--name=".length).trim();
    if (a.startsWith("--user-id=")) result.userId = a.slice("--user-id=".length).trim();
  }
  return result;
}

/**
 * supabase-js auth.admin.* expects legacy JWT service_role. New sb_secret_* keys fail with "Invalid API key".
 * @param {string} serviceKey
 * @param {string} url
 */
function assertServiceRoleKeyShape(serviceKey, url) {
  if (serviceKey.startsWith("sb_")) {
    console.error(
      [
        "SUPABASE_SERVICE_ROLE_KEY starts with sb_ (new Supabase secret key format).",
        "auth.admin.createUser needs the LEGACY JWT service_role key: three dot-separated parts, usually starts with eyJ.",
        "",
        'Dashboard: Project Settings → API → look for "JWT secret" / legacy service_role (not "secret" sb_ key). Copy that JWT.',
        "",
        `URL must be this same project: ${url}`,
        "Docs: https://supabase.com/docs/guides/api/api-keys",
      ].join("\n"),
    );
    process.exit(1);
  }
  const parts = serviceKey.split(".");
  if (parts.length !== 3) {
    console.error(
      "service_role key must be a JWT (3 segments: x.y.z). You may be using a non-JWT key.",
    );
    process.exit(1);
  }
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(b64 + pad, "base64").toString("utf8");
    const payload = JSON.parse(json);
    if (payload.role !== "service_role") {
      console.error(
        `JWT role is "${payload.role}", not service_role — this is anon/publishable, not the admin key.`,
      );
      process.exit(1);
    }
  } catch {
    console.warn("[warn] Could not decode JWT payload; continuing.");
  }
}

/** @param {{ message?: string; code?: string; status?: number }} err */
function isEmailAlreadyExistsError(err) {
  const msg = err?.message ?? "";
  return (
    err?.code === "email_exists" ||
    err?.status === 422 ||
    /already\s+registered|already\s+exists|duplicate|email\s+(already|exists|been\s+registered)|database error checking email/i.test(msg)
  );
}

/**
 * Locate auth user id by normalized email via Admin listUsers pagination.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} emailNormalized lowercased trim email
 * @returns {Promise<string | null>} user uuid
 */
async function findUserIdByEmail(supabase, emailNormalized) {
  const perPage = 1000;
  const maxPages = 50;
  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("listUsers failed while resolving existing user:", error.message);
      return null;
    }
    const users = data?.users ?? [];
    const hit = users.find(
      (u) => (u.email ?? "").trim().toLowerCase() === emailNormalized,
    );
    if (hit?.id) return hit.id;
    if (users.length < perPage) break;
  }
  return null;
}

/**
 * Upsert profile, optional admin role, optional whitelist (idempotent where possible).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} userId
 * @param {{ email: string; password: string; fullName: string; whitelist: boolean; adminRole: boolean }} opts
 */
async function applyProfileRoleWhitelist(supabase, userId, opts) {
  const { error: profileErr } = await supabase.from("profiles").upsert(
    {
      id: userId,
      full_name: opts.fullName,
      credits: 1_000_000,
      is_unlimited: true,
      subscription_tier: "generator",
      subscription_status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (profileErr) {
    console.error("profiles upsert failed:", profileErr.message);
    process.exit(1);
  }
  console.log("Profile updated (credits + is_unlimited + subscription labels).");

  if (opts.adminRole) {
    const { error: roleErr } = await supabase.from("user_roles").insert({
      user_id: userId,
      role: "admin",
    });
    if (roleErr) {
      const isSchemaCache = /schema cache|relation.*does not exist/i.test(roleErr.message ?? "");
      const isDuplicate = roleErr.code === "23505" || roleErr.message?.includes("duplicate");
      if (isDuplicate) {
        console.log("Role admin already present or duplicate skipped.");
      } else if (isSchemaCache) {
        console.warn(
          '[warn] user_roles not in schema cache — run in SQL Editor: NOTIFY pgrst, \'reload schema\'; then re-run seed:test-user.\n' +
          "       Or add role manually: INSERT INTO public.user_roles (user_id, role) VALUES ('" + userId + "', 'admin') ON CONFLICT DO NOTHING;",
        );
      } else {
        console.error("user_roles insert failed:", roleErr.message);
        process.exit(1);
      }
    } else {
      console.log("Role assigned: admin (is_admin() via has_role).");
    }
  }

  if (opts.whitelist) {
    const { error: wlErr } = await supabase.from("whitelisted_users").insert({
      email: opts.email.toLowerCase(),
    });
    if (wlErr) {
      const isDuplicate = wlErr.code === "23505" || wlErr.message?.includes("duplicate");
      const isSchemaCache = /schema cache|relation.*does not exist|column.*does not exist/i.test(wlErr.message ?? "");
      if (isDuplicate) {
        console.log("Whitelist: email already listed (skipped).");
      } else if (isSchemaCache) {
        console.warn(
          "[warn] whitelisted_users schema cache issue — add manually in SQL Editor:\n" +
          "       INSERT INTO public.whitelisted_users (email) VALUES ('" + opts.email.toLowerCase() + "') ON CONFLICT DO NOTHING;",
        );
      } else {
        console.error("whitelisted_users insert failed:", wlErr.message);
        process.exit(1);
      }
    } else {
      console.log("Whitelist entry added (get_user_profile unlimited path).");
    }
  }
}

async function main() {
  // Load .env last so local .env wins over empty/wrong shell exports.
  const env = { ...process.env, ...loadEnv() };
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL)?.trim();
  let serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  // Copy-paste often drops leading "e": valid JWT starts with eyJ (base64 of {" ).
  if (serviceKey && serviceKey.startsWith("yJ") && !serviceKey.startsWith("eyJ")) {
    console.warn('[create-test-user] JWT was missing leading "e" — fixing to "eyJ…" (paste full key next time)');
    serviceKey = `e${serviceKey}`;
  }
  if (!url || !serviceKey) {
    if (!url) {
      console.error("Missing SUPABASE_URL or VITE_SUPABASE_URL in .env");
    }
    if (!serviceKey) {
      console.error(
        [
          "Missing SUPABASE_SERVICE_ROLE_KEY in .env",
          "",
          'Add one line (Project Settings → API → "service_role" secret, JWT starting with eyJ...):',
          "  SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...",
          "",
          "Dashboard URL pattern:",
          "  https://supabase.com/dashboard/project/<project-ref>/settings/api",
          "",
          "Never use VITE_ prefix for this key (browser builds would expose it).",
          "Never commit service_role to git.",
        ].join("\n"),
      );
    }
    process.exit(1);
  }

  assertServiceRoleKeyShape(serviceKey, url);

  const opts = parseArgs(process.argv.slice(2));
  if (!opts.email.includes("@")) {
    console.error("Invalid --email");
    process.exit(1);
  }
  if (opts.password.length < 6) {
    console.error("Password must be at least 6 characters");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --user-id bypasses createUser + listUsers entirely (useful when GoTrue admin API is unreliable).
  if (opts.userId) {
    console.log(`Skipping auth create/lookup — using provided --user-id=${opts.userId}`);
    await applyProfileRoleWhitelist(supabase, opts.userId, opts);
    console.log("\nDone. Sign in with:");
    console.log(`  email: ${opts.email}`);
    console.log(`  password: ${opts.password}`);
    return;
  }

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: opts.email,
    password: opts.password,
    email_confirm: true,
    user_metadata: { full_name: opts.fullName },
  });

  let userId;

  if (createErr) {
    const msg = createErr.message || "";
    if (/invalid api key/i.test(msg)) {
      console.error("Supabase rejected the API key. Check:", msg);
      console.error(
        [
          '• JWT must literally start with "eyJ" (not "yJ"). First character often drops when copying from UI — re-copy whole key.',
          "• Prefer LEGACY JWT service_role — not sb_secret_* (see Dashboard API keys docs).",
          "• role in JWT payload must be service_role (anon key looks identical but rejects admin).",
          "• SUPABASE/VITE_SUPABASE_URL must match the same project (https://<ref>.supabase.co).",
          '• No quotes/spaces/extra chars in SUPABASE_SERVICE_ROLE_KEY.',
        ].join("\n"),
      );
      process.exit(1);
    }
    if (isEmailAlreadyExistsError(createErr)) {
      console.log(`User already exists for ${opts.email} — repairing password + profile/roles/whitelist...`);
      const foundId = await findUserIdByEmail(supabase, opts.email);
      if (!foundId) {
        console.error(
          "Could not find user id by email via listUsers. Remove the user in Dashboard or increase pagination if you have >50k users.",
        );
        process.exit(1);
      }
      userId = foundId;
      const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
        password: opts.password,
        email_confirm: true,
        user_metadata: { full_name: opts.fullName },
      });
      if (updErr) {
        console.error("updateUserById failed:", updErr.message);
        process.exit(1);
      }
      console.log(`Auth user updated: ${opts.email} id=${userId}`);
    } else {
      console.error("createUser failed:", msg);
      process.exit(1);
    }
  } else {
    if (!created?.user?.id) {
      console.error("createUser returned no user id");
      process.exit(1);
    }
    userId = created.user.id;
    console.log(`Auth user created: ${opts.email} id=${userId}`);
  }

  await applyProfileRoleWhitelist(supabase, userId, opts);

  console.log("\nDone. Sign in with:");
  console.log(`  email: ${opts.email}`);
  console.log(`  password: <your --password>`);
  console.log("Admin UI: route /admin (after login) if RequireAdmin passes is_admin RPC.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
