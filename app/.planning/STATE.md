# Project State

**Project:** snap-shot.ai Bug Fix Engagement
**Current Phase:** Phase 3 — Stability & Performance
**Last Updated:** 2026-05-10

## Current Focus

Phase 2: COMPLETE — Data integrity fixed (6/6 must-haves, 2 human verification items pending).
Phase 3: Stabilize HD retry, reduce WASM overhead, isolate critical paths — next.

## Completed Work

### Phase 1 — Core Pipeline Reliability (2026-05-09)
- **STATE-01/03**: Fashion stale exhausted tasks now marked `failed` directly (no intermediate pending requeue)
- **STATE-02**: New migration `20260509000001_claim_generation_task.sql` — `SELECT FOR UPDATE SKIP LOCKED` RPC; both claim sites updated
- **CREDIT-01**: All 3 `decrement_credits` sites check `deductErr || !deductResult`; throw on failure — revenue leak closed
- **CREDIT-02/CONFIG-01–05**: Verified present in source, no changes needed

### Phase 2 — Data Integrity (2026-05-10)
- **AUTH-01/02/03**: OAuth2 token cache consolidated into `vertex-auth.ts` with `refreshPromise` mutex; `fal-adapter.ts` delegates entirely
- **IMG-01**: `uploadAndGetPath` stores bare storage paths in `result_url` — signed URLs never persisted
- **IMG-02/03**: `extractPathFromUrl` handles bare paths + legacy signed URLs; `Generator.tsx` wired with `useSignedUrls` + `resolveImageUrl` at render boundary; `MyImages.tsx` compatible
- Human verification pending: legacy signed URL backward-compat in MyImages, partial results during active generation

## Artifacts

- `.planning/PROJECT.md` — project context
- `.planning/REQUIREMENTS.md` — v1 requirements
- `.planning/ROADMAP.md` — 3-phase plan
- `.planning/codebase/` — codebase map (7 documents)
