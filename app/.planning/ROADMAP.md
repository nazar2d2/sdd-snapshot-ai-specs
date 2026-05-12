# Roadmap: snap-shot.ai Bug Fix Engagement

**Project:** snap-shot.ai — AI Image Generation SaaS reliability fixes
**Milestone:** M1 — Production Reliability

---

## Phase Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Core Pipeline Reliability | Fix P0 bugs in task state machine, credits, and job config | STATE-01–03, CREDIT-01–02, CONFIG-01–05 | 4 |
| 2 | Data Integrity | Fix signed URL expiry and OAuth token race condition | IMG-01–03, AUTH-01–03 | 3 |
| 3 | Stability & Performance | Stabilize HD retry, reduce WASM overhead, isolate critical paths | HD-01–03, PERF-01, QUAL-01–02 | 3 |

---

### Phase 1: Core Pipeline Reliability

**Goal:** Fix the three P0 classes of failures in `generate-image/index.ts`: stale task recovery causing infinite retries, silent credit deduction swallowing, and job config drift where workers can use different model/color params than what was configured.

**Requirements:** STATE-01, STATE-02, STATE-03, CREDIT-01, CREDIT-02, CONFIG-01, CONFIG-02, CONFIG-03, CONFIG-04, CONFIG-05

**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Fix fashion stale exhausted direct-fail + atomic task claim RPC (STATE-01, STATE-02, STATE-03)
- [ ] 01-02-PLAN.md — Propagate credit deduction failure + verify CONFIG requirements (CREDIT-01, CREDIT-02, CONFIG-01–05)

**Success Criteria:**
1. Stale task recovery increments `attempt_count` rather than resetting it; tasks exceeding the hard limit are marked `failed` permanently
2. Task claims use `SELECT ... FOR UPDATE SKIP LOCKED` pattern — concurrent workers cannot claim the same task
3. `generation_jobs` row is created with `model`, `product_config`, and `color_config` JSON fields populated at job creation time; worker reads exclusively from these fields
4. Credit deduction failure throws an error that propagates (not caught-and-logged-silently) or triggers an observable alert

---

### Phase 2: Data Integrity

**Goal:** Fix the two P1 data integrity issues: images disappearing after 24h (signed URL expiry), and Vertex AI OAuth token race condition from duplicate caches.

**Requirements:** IMG-01, IMG-02, IMG-03, AUTH-01, AUTH-02, AUTH-03

**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md — Fix AUTH: consolidate OAuth2 token cache, add refresh mutex (AUTH-01, AUTH-02, AUTH-03)
- [x] 02-02-PLAN.md — Fix IMG: store storage paths instead of signed URLs, add signStoragePathOrUrl helper (IMG-01, IMG-02, IMG-03)
- [x] 02-03-PLAN.md — Gap closure: wire display-time URL signing for bare storage paths (IMG-02, IMG-03)

**Success Criteria:**
1. Generated images are stored with a permanent storage path; signed URLs are generated on-demand at display time and never stored in `result_url`
2. `fal-adapter.ts` has no independent OAuth token cache — delegates entirely to `vertex-auth.ts`
3. Concurrent Vertex AI calls share a single token refresh lock — no duplicate refresh race

---

### Phase 3: Stability & Performance

**Goal:** Stabilize HD generation retry flow, reduce WASM cold-start latency, and extract P0/P1-touched code paths into named handlers (minimal isolation, not full refactor).

**Requirements:** HD-01, HD-02, HD-03, PERF-01, QUAL-01, QUAL-02

**Success Criteria:**
1. HD flow handles anchor-not-ready without silent early return — produces a clear pending/error state
2. WASM ImageScript is not loaded on invocations that don't use it (lazy-load or conditional import)
3. Stale recovery, credit deduction, and job creation logic each live in a named extracted function — no new code in the top-level switch block

---

## Traceability Update

| Requirement | Phase |
|-------------|-------|
| STATE-01, STATE-02, STATE-03 | Phase 1 |
| CREDIT-01, CREDIT-02 | Phase 1 |
| CONFIG-01 – CONFIG-05 | Phase 1 |
| IMG-01, IMG-02, IMG-03 | Phase 2 |
| AUTH-01 – AUTH-03 | Phase 2 |
| HD-01, HD-02, HD-03 | Phase 3 |
| PERF-01 | Phase 3 |
| QUAL-01, QUAL-02 | Phase 3 |
