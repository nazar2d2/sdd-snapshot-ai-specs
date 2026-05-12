<!-- SYNC IMPACT REPORT
Version change: 0.0.0 (template) → 1.0.0
Added sections: Core Principles, Stack Constraints, Development Workflow, Governance
Modified principles: All placeholders replaced with snap-shot.ai specifics
Templates requiring updates:
  ✅ plan-template.md — Constitution Check section governs all plans
  ✅ spec-template.md — Requirements must stay implementation-agnostic
  ✅ tasks-template.md — Tasks must follow TDD-opt-in discipline
Follow-up TODOs: None deferred
-->

# snap-shot.ai Constitution

## Core Principles

### I. Reliability Over Features
Production reliability is the top priority. No new features ship while P0/P1 bugs (revenue leaks,
data loss, silent failures) remain open. Credit deduction MUST be observable and auditable;
any failure to deduct MUST throw an error — never swallow silently. The generation job queue
state machine is the revenue-critical path: every modification requires explicit regression
verification of the stale-recovery and credit-deduction branches.

### II. Explicit Over Implicit
All data persisted to the database MUST be a permanent, stable identifier — never a derived
or time-limited value. Signed URLs MUST be generated at display time from stored storage paths;
they MUST never be written to `result_url`. Foreign keys and immutable IDs are always preferred
over computed values for storage.

### III. Least Privilege & Defence in Depth
Admin endpoints MUST restrict CORS to the production domain (`SITE_URL` env var).
The hardcoded fallback admin email (`snapshot@gmail.com`) is FORBIDDEN in all code paths
(currently present at `src/components/RequireAdmin.tsx` lines 28, 32, 47 — must be removed).
Admin access MUST be determined exclusively by the `is_admin()` RPC and the `profiles.is_admin`
DB flag. No plaintext secrets, tokens, or credentials may be logged at any log level.

### IV. Modularity (Incremental, Not Big-Bang)
The 1535-line `generate-image/index.ts` god-function and the 2513-line `Admin.tsx` god-component
are known liabilities. Refactoring MUST happen as small, named extractions — one named handler or
component per PR — without behaviour changes in the same commit. No new logic may be added directly
to the top-level `switch(action)` block; new actions MUST be extracted to named handler functions
in the same file or a sibling module.

### V. Single Source of Truth for Shared Logic
Duplicate implementations are FORBIDDEN for any non-trivial piece of logic. The Vertex AI OAuth
token cache and refresh logic MUST live exclusively in `vertex-auth.ts`; `fal-adapter.ts` MUST
delegate to it entirely. Any utility used by two or more edge functions MUST live in
`supabase/functions/_shared/`.

### VI. Test-Opt-In (No Mandatory TDD for Fixes)
Zero automated tests exist today. New test coverage is encouraged but not mandatory for bug fixes.
When tests ARE added, the Vitest + React Testing Library + MSW stack is preferred. TDD is
MANDATORY only if explicitly flagged `[TDD]` in a task. All new Supabase Edge Function logic
that contains branching state machine code MUST include at least a smoke-test scenario.

### VII. TypeScript Strictness Uplift
New files MUST use `strict: true`. `as any` casts are FORBIDDEN in new code; use proper type
assertions with `as Type` and add a comment explaining why if unavoidable. `ts-ignore` is
FORBIDDEN. Existing `as any` casts may remain until the file is otherwise touched, at which
point they MUST be resolved.

## Stack Constraints

**Frontend**: React 18 + Vite 5 + TypeScript 5.8 + Tailwind CSS 3 + shadcn/ui (Radix UI)
**Backend**: Supabase Edge Functions (Deno runtime) — no custom Express/Node server
**Database**: Supabase PostgreSQL — migrations in `supabase/migrations/`
**Auth**: Supabase Auth — JWT verified at edge gateway; `is_admin()` RPC for admin checks
**Storage**: Supabase Storage bucket `generated-images` — paths only stored in DB, signed URLs on-demand
**AI**: Google Vertex AI (Gemini) — OAuth via `vertex-auth.ts`; model default `gemini-2.5-flash-image`
**Payments**: Stripe (`npm:stripe@14.21.0`) — webhook events verified via `STRIPE_WEBHOOK_SECRET`
**Email**: Lovable Email API + `@react-email/components` — async queue via pgmq
**State**: TanStack Query v5 for server state; `useState` + `useCallback` for local state
**Routing**: React Router DOM v6 — all routes defined in `src/App.tsx`
**Package manager**: npm (authoritative); bun lockfile also present but npm is CI standard

**Forbidden libraries / patterns**:
- `bcryptjs` (use native `bcrypt`)
- `as any` in new code
- `ts-ignore` anywhere
- Hardcoded admin email string (`snapshot@gmail.com`) in any file
- Signed URLs written to database columns
- New logic added directly to the `switch(action)` block in `generate-image/index.ts`
- CORS `Access-Control-Allow-Origin: *` on admin-scoped edge functions

## Development Workflow

- One component/hook/utility per file; no mega-files for new code
- All SQL schema changes go through `supabase/migrations/` — never mutate schema in application code
- Environment variables:
  - Frontend: `VITE_*` prefix only, accessed via `import.meta.env`
  - Edge Functions: `Deno.env.get()` only
- Path alias `@/` maps to `src/` — use it for all internal imports
- `cn()` from `@/lib/utils` for all conditional class merging
- Errors surface to users via `sonner` toasts; structured logging via `console.error`/`console.log`
  with a `[PREFIX]` tag (e.g., `[WORK]`, `[AUTH]`, `[STRIPE]`)
- Dead code (`Index.tsx`, `fal-vision-adapter.ts`, `tailwind.config copy.ts`) MUST be deleted
  before Phase 3 work begins — they create confusion and inflate bundle size

## Governance

This constitution supersedes all other coding practices and inline comments. Amendments require:
1. A rationale comment explaining the change
2. Update to `LAST_AMENDED_DATE`
3. Major version bump for principle removals/redefinitions; minor bump for additions

All PRs touching the generation job queue, credit deduction, or admin access MUST reference
the relevant requirement ID (e.g., STATE-01, CREDIT-01) in the commit message.

**Version**: 1.0.0 | **Ratified**: 2026-05-12 | **Last Amended**: 2026-05-12
