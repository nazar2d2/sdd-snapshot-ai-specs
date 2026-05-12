# SDD + snap-shot.ai

Monorepo layout:

| Path | Contents |
|------|----------|
| `specs/001-snapshot-ai-rebuild/` | Spec Kit: spec, plan, tasks, contracts (implementation backlog) |
| `app/` | **snap-shot.ai** — Vite + React + Supabase (frontend + Edge Functions + migrations) |
| `.specify/` | Spec Kit templates and scripts |
| `docs/` | Quick guides and conventions |

## Run the web app (локально / local)

```bash
cd app
cp .env.example .env
# Edit .env: set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID (see app/.env.example)
npm install
npm run dev
```

Vite is configured for port **8080** (see `app/vite.config.ts`). Open `http://localhost:8080`.

**Українською:** детальні кроки — у [docs/app-run.md](docs/app-run.md).

## Database & Edge Functions

From `app/`:

```bash
npm run db:link    # once, needs SUPABASE_ACCESS_TOKEN in .env
npm run db:push    # apply migrations
```

Do **not** commit `app/.env` (gitignored). Use `app/.env.example` as a template.

## Git remote

Default remote: `origin` → GitHub repo created for this workspace.
