#!/usr/bin/env node
/**
 * Run Supabase CLI commands using credentials from .env
 * Loads: VITE_SUPABASE_PROJECT_ID, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
 *        SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD
 */
import { readFileSync, existsSync } from "fs";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function run(cmd, args, env = {}) {
  const fullEnv = { ...process.env, ...loadEnv(), ...env };
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      env: fullEnv,
      cwd: rootDir,
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
  });
}

const command = process.argv[2] || "push";
const projectRef = loadEnv().VITE_SUPABASE_PROJECT_ID || "phkwivrcuuvzpgzvvmkv";

if (command === "link") {
  run("npx", ["supabase", "link", "--project-ref", projectRef]).catch(() => process.exit(1));
} else if (command === "push" || command === "migrate") {
  run("npx", ["supabase", "db", "push"]).catch(() => process.exit(1));
} else {
  console.error("Usage: node scripts/db.js [link|push|migrate]");
  process.exit(1);
}
