# SDD + snap-shot.ai

Monorepo layout:

| Path | Contents |
|------|----------|
| `specs/001-snapshot-ai-rebuild/` | Spec Kit: specification, plan, tasks, contracts (implementation backlog) |
| `app/` | **snap-shot.ai** — Vite + React + Supabase (SPA, Edge Functions, migrations, `.planning/` engineering notes) |
| `.specify/` | Spec Kit templates and scripts |
| `docs/` | Guides and conventions |

## Run the web application locally

```bash
cd app
cp .env.example .env
# Edit .env: set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID (see app/.env.example)
npm install
npm run dev
```

The dev server runs on **http://localhost:8080** (see `app/vite.config.ts`).

Full setup (environment variables, database CLI, CI secrets): **[docs/app-run.md](docs/app-run.md)**.

## Database and Edge Functions

From `app/`:

```bash
npm run db:link    # once; requires SUPABASE_ACCESS_TOKEN in .env
npm run db:push    # apply migrations
```

Do **not** commit `app/.env` (gitignored). Use `app/.env.example` as a template.

## Task file paths

Tasks in `specs/001-snapshot-ai-rebuild/tasks.md` use **repo-relative paths** starting with `app/` (for example, `app/src/pages/Generator.tsx`). Run implementation commands from `app/` when the task says so.

## Git remote

Default remote: `origin` — GitHub repository for this workspace.
