# Technology Stack

**Analysis Date:** 2026-05-08

## Languages

**Primary:**
- TypeScript 5.8.x — frontend React application (`src/`)
- TypeScript (Deno runtime) — Supabase Edge Functions (`supabase/functions/`)

**Secondary:**
- SQL — database migrations (`supabase/migrations/`)
- TSX (React JSX) — React components and email templates

## Runtime

**Environment:**
- Browser (SPA) — primary frontend target
- Deno — Edge Functions runtime (Supabase hosted); each function uses `https://deno.land/std@0.168.0/http/server.ts`
- Node.js v24.x — local development toolchain

**Package Manager:**
- npm (lockfile: `package-lock.json` present)
- bun also detected (`bun.lock`, `bun.lockb`) — both lockfiles committed, npm is authoritative for CI/install

## Frameworks

**Core:**
- React 18.3.x — UI component library (`src/`)
- React Router DOM 6.30.x — client-side routing (`src/pages/`)
- Vite 5.4.x — build tool and dev server; config at `vite.config.ts`
  - Uses `@vitejs/plugin-react-swc` for fast SWC-based JSX transform
  - Dev server on port `8080`

**Styling:**
- Tailwind CSS 3.4.x — utility-first CSS; config at `tailwind.config.ts`
  - Fonts: Space Grotesk (display), Inter (body), Prata (serif accents)
  - Custom design tokens: `--logo-purple`, `--electric-blue`, gradients, glow shadows
  - Dark mode: class-based (`darkMode: ["class"]`)
- PostCSS 8.5.x — PostCSS pipeline; config at `postcss.config.js`
- `tailwindcss-animate` — animation utilities

**UI Components:**
- shadcn/ui pattern — Radix UI primitives + CVA variants
  - Full Radix UI suite installed: accordion, alert-dialog, avatar, checkbox, dialog, dropdown-menu, popover, select, slider, tabs, toast, tooltip, etc.
  - Component config: `components.json`
- `class-variance-authority` 0.7.x — variant management for component variants
- `clsx` + `tailwind-merge` — className utilities
- `lucide-react` 0.462.x — icon library

**Form & Validation:**
- `react-hook-form` 7.61.x + `@hookform/resolvers` — form state management
- `zod` 3.25.x — schema validation (used in Edge Functions via `GenerateRequestSchema` and on frontend)

**Data Fetching:**
- `@tanstack/react-query` 5.83.x — server state management and caching

**Animation:**
- `framer-motion` 12.33.x — declarative animations
- `gsap` 3.14.x — GSAP timeline animations
- `animejs` 4.3.x — anime.js animations
- `lottie-react` 2.4.x — Lottie JSON animation playback (`src/assets/lottie/`)
- `lenis` 1.3.x — smooth scrolling

**Email Rendering (Edge Functions):**
- `@react-email/components` 0.0.22 — React-based email template rendering
- Templates in `supabase/functions/_shared/email-templates/`

**Testing:**
- Not detected — no test runner configured, no test files found

**Build/Dev:**
- Vite 5.4.x — `npm run dev`, `npm run build`, `npm run preview`
- ESLint 9.32.x — linting; config at `eslint.config.js`
  - `eslint-plugin-react-hooks` — hooks rules
  - `eslint-plugin-react-refresh` — HMR safety
  - `typescript-eslint` 8.38.x — TypeScript-aware linting
- `lovable-tagger` 1.1.x — dev-only Lovable component tagging (injected in dev mode via `vite.config.ts`)

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.89.x — database, auth, storage, and Edge Function calls; client at `src/integrations/supabase/client.ts`
- `react-router-dom` 6.30.x — all page routing
- `@tanstack/react-query` 5.83.x — all server state; missing this breaks all data fetching

**Infrastructure:**
- `stripe` 14.21.0 (npm, Edge Functions via `npm:stripe@14.21.0`) — payment processing
- `zod` 3.25.x — request validation in Edge Functions (GenerateRequestSchema)
- `date-fns` 3.6.x — date utilities
- `recharts` 2.15.x — data visualization (admin dashboard)
- `embla-carousel-react` 8.6.x — image carousel
- `react-resizable-panels` 2.1.x — resizable panel layouts
- `vaul` 0.9.x — drawer component
- `sonner` 1.7.x — toast notifications
- `next-themes` 0.3.x — dark/light theme management
- `cmdk` 1.1.x — command palette
- `input-otp` 1.4.x — OTP input
- `react-day-picker` 8.10.x — date picker

## Configuration

**Environment:**
- `.env` file present (contents not read — see INTEGRATIONS.md for required var names)
- `.env.example` present — use as reference for required variables
- Frontend env vars accessed via `import.meta.env.VITE_*`
- Edge Function env vars accessed via `Deno.env.get()`

**TypeScript:**
- Strict mode: OFF (`"strict": false` in `tsconfig.app.json`)
- `noImplicitAny`: false, `noUnusedLocals`: false, `noUnusedParameters`: false
- Path alias: `@/` → `./src/`
- Target: ES2020, module: ESNext

**Build:**
- `tsconfig.json` — root composite config referencing `tsconfig.app.json` and `tsconfig.node.json`
- `tsconfig.app.json` — browser/React config (`src/` only)
- `tsconfig.node.json` — Node.js config (Vite config files)

## Platform Requirements

**Development:**
- Node.js v24.x (detected in environment)
- npm or bun as package manager
- Supabase CLI for Edge Function deployment (`supabase/config.toml`, project ID: `phkwivrcuuvzpgzvvmkv`)

**Production:**
- Static SPA hosting (Vite build output) — likely Lovable platform (`lovable-tagger` dev dep, `imagifygenimagegpt.lovable.app` sample URL in email templates)
- Supabase cloud — database, auth, storage, Edge Functions
- Domain: `snap-shot.ai` (from email template constants in `supabase/functions/auth-email-hook/index.ts`)

---

*Stack analysis: 2026-05-08*
