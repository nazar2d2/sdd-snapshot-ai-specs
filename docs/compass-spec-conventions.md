# A reusable AI skill for software project planning

The strongest blueprint for an AI-buildable project planning skill combines **GitHub Spec Kit's four-artifact pipeline** (Constitution → Spec → Plan → Tasks) with **Anthropic's SKILL.md format**, **Scrum's user story discipline** (INVEST + Given/When/Then + Definition of Done), and **Jeff Patton's story mapping** for MVP scoping. This combination is now the de-facto standard across 30+ coding agents and is explicitly designed for LLM consumption. The single highest-leverage decision is to keep specs implementation-agnostic, push tech-stack constraints into a separate immutable `constitution.md`, and emit machine-parseable IDs (`US-NNN`, `AC-NNN-X`, `T###`) with explicit `[P]` parallel-execution markers and `depends_on` DAGs. Project-type differences (B2B SaaS, internal tools, client-facing) are best handled as **tags plus three drop-in template overlays** that add type-specific epic libraries, NFRs, and stakeholder structures rather than as separate skills. What follows is a complete blueprint — folder structure, frontmatter conventions, templates, examples, and the underlying methodology — that a skill author can lift directly.

## The blueprint at a glance

The recommended skill produces a repository whose folder structure is itself the spec. It blends three open standards: **AGENTS.md** (the cross-tool entrypoint, used by Codex, Cursor, Aider, Copilot, Windsurf, Jules, Factory and 60k+ repos), **Spec Kit's `specs/NNN-feature/` layout** (the canonical artifact pipeline used by GitHub's official toolkit), and **Anthropic Skills** (`SKILL.md` with YAML frontmatter for progressive disclosure). The skill's own files live in one location; the artifacts it generates live in another.

```
project-planning-skill/                 # the skill itself
├── SKILL.md                            # frontmatter + orchestration prompt
├── assets/
│   ├── constitution-template.md
│   ├── spec-template.md
│   ├── plan-template.md
│   ├── tasks-template.md
│   ├── story-template.yaml
│   ├── overlays/
│   │   ├── b2b-saas.md                 # tag-triggered epic library + NFRs
│   │   ├── internal-tool.md
│   │   └── client-facing.md
│   └── agents-md-template.md
└── references/
    ├── invest-checklist.md
    ├── splitting-patterns.md           # SPIDR + Lawrence flowchart
    ├── prioritization-frameworks.md    # RICE / MoSCoW / Kano / WSJF
    ├── validation-rules.md             # IDs unique, ACs use GWT, etc.
    └── safety-principles.md            # negative-space, anti-hallucination

# what the skill *generates* in the user's repo:
repo/
├── AGENTS.md                            # cross-agent entrypoint (CLAUDE.md symlinks here)
├── .specify/memory/constitution.md      # immutable principles + stack
└── specs/001-feature-slug/
    ├── spec.md                          # what + why; no tech
    ├── plan.md                          # tech stack, architecture
    ├── data-model.md
    ├── contracts/api-spec.json
    ├── quickstart.md                    # how to verify "done"
    └── tasks.md                         # T### with [P] markers and DAG
```

The **single most important design choice** in the skill is the SKILL.md frontmatter `description` field, because Claude scans it to decide whether to invoke the skill. Trigger phrases like *"plan a feature," "write a spec," "convert PRD," "break this into tasks,"* and *"create user stories"* must appear there. The body of SKILL.md should remain under ~5,000 tokens; deeper guidance lives in `references/` and is loaded on demand.

## The methodology: Scrum core with shaped epics

The skill's underlying methodology is **Scrum-with-shaping**: Scrum's user-story discipline at the team level, augmented by Shape Up's pitching/appetite for epics and Jeff Patton's story mapping for MVP scoping. This hybrid resolves the most common Scrum failure mode — the flat backlog that Patton calls *"a bag of context-free mulch"* — without abandoning sprints, story points, or the Definition of Done.

The artifact hierarchy compresses six common levels into two-plus-roadmap, which is what Mountain Goat Software's Mike Cohn and most modern teams (Linear, GitLab, Basecamp) actually practice:

| Level | Horizon | Owner | What it is |
|---|---|---|---|
| **Theme / OKR** | 1+ year | Exec | Strategic pillar tied to a metric |
| **Initiative** | 3–12 months | PM Lead | Roadmap line item; collection of epics |
| **Epic** | 2–6 weeks | PM | A *shaped pitch*: problem, appetite, solution sketch, rabbit holes, no-gos |
| **User Story** | 1–10 days | Dev team | INVEST-compliant slice with Given/When/Then ACs |
| **Task** | hours | Engineer | File-path-specific implementation step |

**Inside the team backlog, only two levels exist: epic and story.** Themes and initiatives live in the roadmap layer (Now/Next/Later format from ProdPad's Janna Bastow), not in Jira. This is what Atlassian calls *"epics and stories"* and what Aha! and SAFe expand into deeper hierarchies — but for AI-agent consumption, fewer levels means fewer tokens spent on metadata.

## Writing user stories that survive AI consumption

A user story in this skill is a **Connextra narrative + Gherkin acceptance criteria + machine-readable frontmatter**. The Connextra form — *"As a `<persona>`, I want `<capability>`, so that `<benefit>`"* — was popularized by Mike Cohn and remains the consensus format across Atlassian, Scrum.org, Mountain Goat, and Agile Alliance. The "so that" clause is non-negotiable: it encodes business value, which is what makes the story Valuable in INVEST and prevents the most common anti-pattern (tasks disguised as stories).

The skill enforces **INVEST** as a Definition of Ready gate: Independent, Negotiable, Valuable, Estimable, Small, Testable. Atlassian, Scrum.org, and Scrum Alliance all recommend this. The most common INVEST failure is *horizontal slicing* — separate stories for "build the API" and "build the UI" — which violates Independent and Valuable simultaneously because neither slice delivers user value alone. Every story must be a **vertical slice** through UI + business logic + data.

**Acceptance criteria use Given/When/Then (Gherkin) syntax** because it maps directly to test scaffolding (Cucumber, Playwright, Vitest table tests) and reads as executable specification. The skill rejects vague criteria like "system should be fast" in favor of concrete thresholds ("p95 < 500ms with 10,000 concurrent users"). Mike Cohn's rule of thumb — most stories need **1–3 acceptance criteria; 4+ usually means the story is too big** — is encoded in the validation step.

A canonical story in this skill looks like this:

```markdown
### US-003: New user signs up with email + password  [P1]

**As a** new visitor
**I want to** register with email + password
**So that** I can save my profile and return later.

**Independent Test:** Submit registration form; assert User row + session cookie exist.

#### Acceptance scenarios
- **AC-003-A** — Given a visitor on /signup, When they submit a valid email and
  password ≥12 chars, Then a User row is created and they are redirected to /welcome.
- **AC-003-B** — Given the email is already in use, When form is submitted,
  Then HTTP 409 `{"error":"email_taken"}` is returned and no row is written.
- **AC-003-C** — Given any successful signup, When the response returns,
  Then the password is stored as a bcrypt hash (cost ≥12), never plaintext.

#### Out of scope (negative space)
- OAuth/SSO (see US-009)
- Email verification flow (see US-005)

#### Dependencies
- Depends on: US-001 (Postgres schema), US-002 (session middleware)
- Blocks: US-007 (profile page)
```

The **"Out of scope" block is the single biggest difference between human-readable and AI-readable specs.** Without it, LLMs hallucinate "obvious next features" and bloat the implementation. The Smithery LLM-native PRD skill makes this section mandatory; Spec Kit's spec-template uses `[NEEDS CLARIFICATION: ...]` markers for the same reason — they suppress guessing.

## Splitting stories: SPIDR plus the Lawrence flowchart

When an epic produces a story too big for one sprint, the skill applies Mike Cohn's **SPIDR** patterns in order: **S**pike (research timebox if too uncertain to estimate), **P**aths (split user-flow alternatives), **I**nterfaces (split by browser/device), **D**ata (split by data type), **R**ules (relax business rules and add later). Cohn explicitly recommends trying spikes *last* — only after the other four fail. Richard Lawrence's complementary flowchart from Humanizing Work adds Workflow Steps, Happy/Sad Path, CRUD operations, and Defer Performance as additional splits.

The most useful split for MVP scoping is **happy/sad path**: build the happy path as the first story, defer error handling to later stories. This produces a walking skeleton (Patton's term) — a thin end-to-end vertical slice that proves the architecture works before edge cases multiply.

## Definition of Done is universal; Definition of Ready is optional

The skill ships with a default Definition of Done that applies to *every* story and a Definition of Ready that gates entry to a sprint. **Atlassian, Scrum Alliance, and Scrum.org agree DoD is canonical Scrum; DoR is supplemental** ("training wheels" in Scrum Alliance's words) and risks becoming a waterfall gate if over-specified. The skill makes DoD a section in the constitution (immutable across stories) and DoR a YAML checklist in the story template that defaults to INVEST checks plus AC-written and dependencies-resolved.

A pragmatic Definition of Done covers code-merged, peer-reviewed, tests-green, ACs-verified, docs-updated, accessibility-checked (WCAG 2.1 AA), security-reviewed-if-applicable, deployed-to-staging, and PO-accepted. **The trap is putting NFRs into individual story ACs** — they belong in DoD because they apply universally. Mike Cohn calls this the "NFR tax": once accepted, the team must remain in compliance for the rest of the project.

## Project-type overlays

Three drop-in overlay files specialize the skill without forking it. Each overlay contributes a recurring epic library, NFR defaults, and stakeholder list that the skill merges into the generated spec when the user tags the project.

**B2B SaaS overlay** seeds the spec with the recurring epic spine that appears across WorkOS, Clerk, Linear, and Stripe-built products: **authentication, multi-tenancy, RBAC, enterprise SSO/SCIM, billing/subscriptions, admin console, audit logs, webhooks, notifications, and reporting**. NFR defaults include SOC 2 controls, 99.9% uptime, sub-200ms p95 latency, encryption at rest and in transit, and tenant-isolation tests. Multi-tenancy is flagged as an *architecture decision, not a feature* — it must be planned from day one because retrofitting is the top SaaS pain point. Stakeholders include Security/Compliance and Solutions Engineering, who often steer enterprise-readiness items.

**Internal tool overlay** inverts the polish/security balance. Visual polish is deprioritized; **security and audit are heightened, not relaxed**, because internal tools touch production data. Sprint cadence shifts from two-week sprints to kanban/continuous flow. Discovery is short — users are one Slack message away. The build-vs-buy decision is explicit: low-code platforms (Retool, Budibase, Appsmith, ToolJet) handle 80% of US internal-tool needs and should be evaluated before custom code. The example refund tool story (US-011 in the example library below) demonstrates the pattern: minimal UI but heavy guardrails — RBAC, dollar-threshold approvals, immutable audit log.

**Client-facing/agency overlay** is the most different. It mandates a **Statement of Work as the project's legal scope ceiling**, with explicit exclusions, single named approver, round-counted revisions, change-request process, and silence-clause. Polish and performance budgets are first-class NFRs (Lighthouse 90+ on mobile, WCAG 2.1 AA verified, browser matrix). Handoff is a distinct project phase: source code, credentials, README, runbooks, training video, and warranty window. The PMI's Wagner case study of an 18-month fixed-price imaging project that ballooned to four years remains the canonical warning: agile + fixed-price + fixed-scope is mathematically inconsistent, so the overlay forces explicit change control.

## The frameworks, integrated

Five product-planning frameworks earn their place in the skill, each in a different phase. **Jeff Patton's Story Mapping** structures the discovery output: a backbone of user activities along the top, the walking skeleton (MVP) directly underneath, and progressively-less-essential rows below. The walking skeleton becomes the Spec Kit Phase 3 "User Story 1 [P1]" set. **Shape Up's pitch format** structures the epic itself — Problem, Appetite, Solution (breadboard or fat-marker sketch), Rabbit Holes, No-Gos — and the appetite *replaces* story-point estimation at the epic level (appetites start with a number and end with a design; estimates do the reverse).

**RICE scoring** (Reach × Impact × Confidence ÷ Effort, originated at Intercom by Sean McBride) ranks initiatives quantitatively. **MoSCoW** (Must/Should/Could/Won't, from DSDM) defines the MVP at the story level: the Must-haves are the Minimum Usable Subset. The healthy ratio is roughly 60% Must / 25% Should / 10% Could / 5% Won't — if 90% are "Must," nothing is prioritized. **Kano** is reserved for satisfaction analysis (must-be vs. performance vs. delighter), and **WSJF** for SAFe-scale portfolios where Cost of Delay matters more than absolute value.

The integration flow is: Strategy/OKRs → Discovery (Cagan's four risks: value, usability, feasibility, viability + Torres's Opportunity Solution Tree) → Shaping (Shape Up pitch + story map) → Prioritization (RICE for initiatives, MoSCoW for MVP scope) → Roadmap (Now/Next/Later, outcome-based) → Plan (epic → stories → tasks). Each step produces a specific artifact in the skill's output tree.

## The AI-optimized output format

The skill's output format is engineered for LLM consumption, not human aesthetics. Six conventions distinguish it from a traditional PRD:

**Stable IDs everywhere.** Every story is `US-NNN`, every acceptance criterion `AC-NNN-X`, every task `T###`. This enables traceability across spec → plan → tasks → PR → tests, and lets the agent answer questions like "which tasks implement AC-003-B?" deterministically.

**The `[P]` parallel marker and explicit `depends_on` DAG.** Spec Kit's tasks-template uses `[P]` to mark tasks that touch different files with no shared dependencies — these can run in parallel waves. Combined with frontmatter `depends_on: [T010, T011]`, the agent schedules execution as a DAG, not a Gantt chart. A typical generated DAG section reads: *Wave 1 (parallel): T001 [P], T002 [P], T003 [P]. Wave 2 (after Wave 1): T010 (depends on T001, T002), T011 (depends on T003).*

**File paths in every task.** Tasks without explicit paths cause path-hallucination. A task reads `T022 [US-003] Implement POST /api/v1/auth/register in src/routes/auth/register.ts (depends on T010, T011)` — the path is required, not optional.

**Negative space and forbidden patterns.** Each spec includes "Out of Scope" with at least one item, and the constitution lists forbidden libraries (e.g., "no `bcryptjs`, use native `bcrypt`") and patterns (e.g., "no `any`, no `ts-ignore`, no `eval`, no plaintext password logging"). The Smithery LLM-native PRD skill extends this with `temperature: 0.2` and a persona directive (*"You MUST NOT deviate from technical constraints without explicit approval"*) in frontmatter — these noticeably reduce hallucinated drift.

**Capabilities over file structure in always-loaded files.** AGENTS.md and CLAUDE.md must describe what the system *does* and how to build/test it, not where every file lives, because file paths drift and agents poison their own context with stale paths. The detailed structure lives in the spec, which the agent loads on demand.

**Token-budget discipline.** Frontier reasoning models follow ~150–200 instructions reliably; smaller models far fewer. Always-loaded files (AGENTS.md, CLAUDE.md, root rules) should stay under 80–150 lines. Anything larger goes in `docs/` or `references/` and is `@docs/architecture.md`-referenced for on-demand loading.

A canonical machine-readable user story in YAML form looks like:

```yaml
id: US-003
title: New user signs up with email + password
priority: P1
status: ready
type: feature
tags: [auth, onboarding, b2b-saas]
epic: EP-001-auth
depends_on: [US-001, US-002]
blocks: [US-007]
estimate: 3
persona: new-visitor
narrative: >
  As a new visitor, I want to register with email and password,
  so that I can save my profile and return later.
acceptance_criteria:
  - id: AC-003-A
    given: a visitor on /signup with no active session
    when: they submit a valid email and password ≥12 chars
    then: a User row is created and they are redirected to /welcome
  - id: AC-003-B
    given: the email is already in use
    when: form is submitted
    then: HTTP 409 {"error":"email_taken"} is returned, no row written
negative_space:
  - Do NOT auto-login if email is unverified
  - Do NOT add OAuth in this story (see US-009)
constraints:
  forbidden_libraries: [bcryptjs]
  required:
    - bcrypt cost factor ≥12
    - rate limit 5 req/min/IP
api_contracts:
  - method: POST
    path: /api/v1/auth/register
    request_schema: contracts/register.request.json
    response_schema: contracts/register.response.json
```

## A library of example artifacts

The skill ships with a reference library of fully-fleshed examples that demonstrate the format on common SaaS surfaces. The four most instructive examples cover **enterprise SSO configuration** (showing how compliance-grade ACs encode test mode, JIT provisioning, audit logging, and break-glass owners); **Stripe subscription upgrade** (encoding the actual Stripe lifecycle: incomplete → active, proration, 3DS failure handling, webhook idempotency, entitlement-cache invalidation within 30 seconds); **outbound webhook delivery** (with the exponential-backoff retry schedule 1m/5m/30m/2h/12h/24h, HMAC-SHA256 signing, and replay endpoint); and **audit log viewer** (with immutability — *"any user attempting to edit returns 403 and the attempt is itself logged"* — and 7-year retention on Enterprise plans).

For epic breakdowns, the skill includes three reference epics: a **Subscription Billing epic** broken into 12 stories (pricing table, checkout, trial flow, plan management, dunning, churn dashboard, discount codes, tax/VAT, audit export, NFRs); a **User Onboarding epic** organized around the "first value in <5 minutes" outcome with funnel events (signup_started → email_verified → workspace_created → invited_member → first_action_completed); and a **Real-Time Collaboration epic** covering presence, cursors, locks, CRDT-based conflict resolution, and the cursor-update p95 < 100ms NFR.

For MVP scoping, two reference documents demonstrate the format: a **6-week async standup tool** with explicit "out of scope for v1" (mobile app, Slack integration, AI summary, multi-team workspaces, billing) and a measurable success metric (*"30% of invited users record at least 3 standups in week 1"*); and a **MoSCoW-formatted hotel-booking MVP** that allocates Must/Should/Could/Won't across the feature set.

## What this changes about how you plan

The deepest insight from synthesizing this research is that **AI agents and humans want subtly different specs**, and the gap is closeable with a small set of disciplined conventions, not a different methodology. Humans tolerate ambiguity, infer "obvious next features," and treat the written story as a memory aid for a conversation (Mike Cohn's "card → conversation → confirmation"). LLMs do none of these things reliably: they need explicit IDs, explicit out-of-scope sections, explicit forbidden patterns, explicit file paths, and explicit DAGs. Every one of these is *also* good for humans — they reduce miscommunication, scope creep, and onboarding cost — but humans rarely demand them.

The second insight is that **Spec Kit, Anthropic Skills, and AGENTS.md have already converged** on the answer. Spec Kit provides the artifact pipeline; Skills provides the reusable invocation format; AGENTS.md provides cross-tool portability. A 2024-era project planning skill that ignored these would create another silo; a 2026-era skill that builds on all three is portable across Claude Code, Cursor, Codex, Copilot, Aider, Windsurf, and Jules without modification.

The third, and most actionable, insight is that **the constitution is the most underrated artifact**. It is the only file that should never change without deliberate human review, and it is where stack constraints, library preferences, testing rules ("no implementation before tests are red"), and architectural principles ("library-first, max 3 top-level packages") belong. Pulling these out of every individual spec eliminates 80% of context-window waste and 90% of agent drift. A skill that produces a one-page constitution alongside its first spec.md will outperform one that doesn't, even if the spec.md itself is identical.

Build the skill once with these conventions; it will compose with every coding agent that exists today and almost certainly with every one shipping in the next two years.