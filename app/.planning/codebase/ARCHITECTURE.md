# Architecture
<!-- last_mapped_commit: see git log -->
<!-- mapped: 2026-05-08 -->

## Pattern

**Single-Page Application (SPA) + Backend-as-a-Service (BaaS)**

- React 18 SPA (Vite) — all UI logic runs in the browser
- Supabase handles: auth, Postgres DB, file storage, and edge functions (Deno runtime)
- No custom backend server — all server-side logic lives in Supabase Edge Functions

## Layers

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                     │
│  Pages → Components → Hooks → Supabase Client SDK       │
├─────────────────────────────────────────────────────────┤
│  Supabase Edge Functions (Deno)                          │
│  generate-image · stripe-webhook · admin-*               │
├─────────────────────────────────────────────────────────┤
│  Supabase Platform                                       │
│  PostgreSQL · Auth · Storage · Realtime                  │
├─────────────────────────────────────────────────────────┤
│  External APIs                                           │
│  Google Vertex AI (Gemini image gen) · Stripe            │
└─────────────────────────────────────────────────────────┘
```

## Entry Points

- **`src/main.tsx`** — React app bootstrap, mounts `<App />`
- **`src/App.tsx`** — Root router (React Router v6), defines all routes
- **`supabase/functions/generate-image/index.ts`** — Primary edge function (1535 lines), handles all image generation actions

## Routing Structure

| Route | Auth | Component |
|---|---|---|
| `/` | Public | `Homepage` |
| `/auth` | Public | `Auth` |
| `/reset-password` | Public | `ResetPassword` |
| `/pricing` | Public | `PricingPage` |
| `/admin/login` | Public | `AdminLogin` |
| `/admin` | Admin only | `Admin` (behind `RequireAdmin`) |
| `/app` | Auth required | `Generator` (behind `RequireAuth` + `SidebarLayout`) |
| `/prompt-builder` | Auth required | `PromptBuilder` |
| `/profile` | Auth required | `Profile` |
| `/my-images` | Auth required | `MyImages` |

Auth guards: `src/components/RequireAuth.tsx`, `src/components/RequireAdmin.tsx`

## Image Generation Flow (Core)

The generation flow is a **durable job queue** pattern:

```
Client: niche → configure → submit
         ↓
  POST generate-image { action: "create_job" }
         ↓
  Postgres: generation_jobs + generation_tasks rows created
         ↓
  Client polls: parallel workers call { action: "work" }
         ↓
  Edge fn claims task → calls Vertex AI → uploads to Storage
         ↓
  Client polls results → displays signed URL images
```

- Multi-step UI flow in `src/pages/Generator.tsx` (niche → config → loading → results)
- Retry logic in `src/lib/invokeEdgeFunctionWithRetry.ts`
- HD generation is a separate follow-up job after standard anchor image generation

## Data Flow

- **Read:** Hooks (`src/integrations/supabase/hooks/`) query Supabase directly with the JS client
- **Write:** Direct Supabase client calls from hooks/components, or via edge functions for sensitive ops
- **State:** TanStack Query (`@tanstack/react-query`) for server state caching; local `useState` for UI state
- **Auth state:** Supabase auth session, persisted in `localStorage`

## Key Abstractions

| File | Purpose |
|---|---|
| `src/integrations/supabase/client.ts` | Singleton Supabase client |
| `src/integrations/supabase/types.ts` | Auto-generated DB types |
| `src/integrations/supabase/hooks/` | Data-fetching hooks (useCredits, useUserImages, useProfile) |
| `src/lib/invokeEdgeFunctionWithRetry.ts` | Resilient edge function caller with retry |
| `supabase/functions/_shared/fal-adapter.ts` | Vertex AI integration (OAuth + image gen) |
| `supabase/functions/_shared/vertex-auth.ts` | Vertex AI OAuth token management |

## Known Structural Issues

- `Generator.tsx` vs `Index.tsx` — duplicate generation pages; `Index.tsx` appears orphaned
- `generate-image/index.ts` is a 1535-line god-function (auth + job management + AI calling + storage all in one)
- `Admin.tsx` is 2513 lines — entire admin dashboard in one component
