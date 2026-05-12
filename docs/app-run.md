# Running the snap-shot.ai application (`app/`)

## What this is

The **`app/`** directory contains the full **snap-shot.ai** product: React (Vite), Supabase client, Edge Functions under `app/supabase/functions/`, and SQL migrations under `app/supabase/migrations/`.

The repository root (`specs/`, `.specify/`) holds **Spec Kit** artifacts: specification, implementation plan, and task list (`specs/001-snapshot-ai-rebuild/tasks.md`).

Internal engineering notes from the upstream archive live under **`app/.planning/`** (architecture, roadmap, concerns).

## Requirements

- **Node.js** 18+ (20 or 22 recommended)
- **npm** (this repo uses `package-lock.json`)
- A Supabase project and API keys from the Supabase Dashboard → **Project Settings → API**

## Steps

### 1. Go to the application directory

```bash
cd app
```

### 2. Environment variables

```bash
cp .env.example .env
```

Edit **`app/.env`** (this file is **not** committed to git):

| Variable | Source |
|----------|--------|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PROJECT_ID` | Same `<project-ref>` as in the URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon / publishable key from the API settings |
| `SUPABASE_ACCESS_TOKEN` | Optional, for `npm run db:link` / `npm run db:push` — from **Account → Access Tokens** |

`app/vite.config.ts` includes a last-resort fallback project ref. For your **own** Supabase project, set all values explicitly in `.env`.

### 3. Install dependencies

```bash
npm install
```

### 4. Start the development server

```bash
npm run dev
```

Open **http://localhost:8080** (port is set in `app/vite.config.ts`).

### 5. Database migrations (optional)

Requires the Supabase CLI and tokens in `.env`:

```bash
npm run db:link
npm run db:push
```

## Continuing development

1. **Application code** lives under **`app/`**. Commit from the repo root, for example: `git add app/src/...`.
2. **Requirements and tasks** live under **`specs/001-snapshot-ai-rebuild/`**. Use `/speckit-implement` in Cursor or implement manually against `tasks.md`.

Never commit `.env` or secrets.

## GitHub Actions (Edge Function deploy)

`app/.github/workflows/deploy_functions.yml` uses **`secrets.SUPABASE_ACCESS_TOKEN`**.

In the GitHub repository: **Settings → Secrets and variables → Actions → New repository secret**  
Name: `SUPABASE_ACCESS_TOKEN`  
Value: a Supabase personal access token from [Supabase Account → Access Tokens](https://supabase.com/dashboard/account/tokens).

If an old workflow ever contained a hard-coded token, **revoke that token** in Supabase and use a **new** token only in this GitHub secret.
