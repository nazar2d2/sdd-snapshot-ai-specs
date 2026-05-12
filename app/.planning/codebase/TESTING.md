# Testing
<!-- last_mapped_commit: see git log -->
<!-- mapped: 2026-05-08 -->

## Coverage Summary

**Zero automated test coverage.** No test files, no test framework, no CI test pipeline found anywhere in the codebase.

## Framework

- **None installed.** No Vitest, Jest, Playwright, Cypress, or any testing library in `package.json` (dev or prod dependencies).
- No `*.test.ts`, `*.spec.ts`, `*.test.tsx`, or `*.spec.tsx` files found.
- No `__tests__/` directories.

## CI/CD

- No CI configuration found (no `.github/workflows/`, no `.circleci/`, no `Dockerfile`).
- Testing/deployment is fully manual.

## Test Scripts

- No `test`, `test:watch`, or `test:e2e` scripts in `package.json`.
- Available scripts: `dev`, `build`, `build:dev`, `lint`, `preview`, `db:link`, `db:push`, `db:migrate`.

## Linting

ESLint is the only automated quality check:

```bash
npm run lint   # runs eslint .
```

Config: `eslint.config.js` with `typescript-eslint` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`.

## Manual Testing Approach

Based on code patterns, the team tests manually in development:
- `npm run dev` — Vite dev server with HMR
- Supabase local dev or staging environment via `VITE_SUPABASE_URL`

## Implications for New Work

- **No regression safety net** — any change can break existing behavior without detection
- High-risk areas that especially need test coverage:
  - Generation job queue state machine (`supabase/functions/generate-image/index.ts`)
  - Credit deduction flow (revenue-critical, known silent failure — see CONCERNS.md)
  - Stale task recovery logic (multiple regressions in git history)
  - Auth guards (`RequireAuth`, `RequireAdmin`)
- If adding tests, recommended starting stack: **Vitest** (compatible with Vite) + **React Testing Library** for components + **MSW** for Supabase mock
