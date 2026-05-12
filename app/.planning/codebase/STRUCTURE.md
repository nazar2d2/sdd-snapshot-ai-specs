# Structure
<!-- last_mapped_commit: see git log -->
<!-- mapped: 2026-05-08 -->

## Directory Layout

```
Snapshot1/
├── src/                          # React SPA source
│   ├── App.tsx                   # Root component, all routes defined here
│   ├── main.tsx                  # App bootstrap
│   ├── index.css                 # Global styles + Tailwind base
│   ├── App.css                   # App-level styles
│   ├── pages/                    # Route-level page components
│   │   ├── Generator.tsx         # Main generation flow (~large)
│   │   ├── Admin.tsx             # Admin dashboard (2513 lines)
│   │   ├── Homepage.tsx          # Public marketing page
│   │   ├── Auth.tsx              # Login/signup
│   │   ├── ResetPassword.tsx
│   │   ├── PricingPage.tsx
│   │   ├── Profile.tsx
│   │   ├── MyImages.tsx
│   │   ├── PromptBuilder.tsx
│   │   ├── Index.tsx             # Orphaned duplicate of Generator
│   │   ├── AdminLogin.tsx
│   │   ├── Maintenance.tsx
│   │   └── NotFound.tsx
│   ├── components/               # Shared UI components
│   │   ├── ui/                   # shadcn/ui primitives (Radix-based)
│   │   ├── SidebarLayout.tsx     # App shell with sidebar
│   │   ├── AppSidebar.tsx        # Navigation sidebar
│   │   ├── RequireAuth.tsx       # Auth guard wrapper
│   │   ├── RequireAdmin.tsx      # Admin guard wrapper
│   │   ├── Generator-related:
│   │   │   ├── FashionFlow.tsx
│   │   │   ├── HomeDecorFlow.tsx
│   │   │   ├── NicheSelection.tsx
│   │   │   ├── ColorVariantSelector.tsx
│   │   │   ├── ImageResults.tsx
│   │   │   ├── ImageUpload.tsx
│   │   │   ├── LoadingState.tsx
│   │   │   ├── StepProgress.tsx
│   │   │   └── FlowBreadcrumb.tsx
│   │   ├── CreditTopUpModal.tsx
│   │   ├── ChangePasswordCard.tsx
│   │   ├── CitySelect.tsx
│   │   ├── NavLink.tsx
│   │   ├── AdminProfileTab.tsx
│   │   ├── NewHome/              # Newer homepage components
│   │   └── homepage/             # Homepage section components
│   ├── hooks/                    # App-level custom hooks
│   │   ├── use-mobile.tsx        # Responsive breakpoint detection
│   │   ├── use-toast.ts          # Toast notification hook
│   │   ├── useCustomColors.ts    # User custom color management
│   │   ├── usePromptConfig.ts    # Prompt configuration state
│   │   └── useViewConfig.ts      # View/display configuration
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts         # Supabase client singleton
│   │       ├── types.ts          # Auto-generated DB type definitions
│   │       └── hooks/
│   │           ├── useCredits.ts       # Credit balance fetching
│   │           ├── useUserImages.ts    # User image gallery (fetches 500 rows)
│   │           └── useProfile.ts      # User profile data
│   ├── lib/
│   │   ├── utils.ts              # cn() utility (clsx + tailwind-merge)
│   │   └── invokeEdgeFunctionWithRetry.ts  # Resilient edge fn caller
│   └── assets/                   # Static assets
├── supabase/
│   ├── functions/                # Edge Functions (Deno runtime)
│   │   ├── generate-image/
│   │   │   └── index.ts          # Core generation function (1535 lines)
│   │   ├── _shared/              # Shared utilities across functions
│   │   │   ├── fal-adapter.ts    # Vertex AI image generation
│   │   │   ├── vertex-auth.ts    # Vertex AI OAuth token management
│   │   │   └── fal-vision-adapter.ts  # Orphaned (FAL_KEY, not imported)
│   │   └── [other functions]/
│   └── migrations/               # SQL migration files
├── public/                       # Static public assets
├── scripts/
│   └── db.js                     # Database management script
├── index.html                    # Vite entry HTML
├── package.json
├── vite.config.ts (implied)
├── tailwind.config.ts            # Tailwind config (active)
├── tailwind.config copy.ts       # Stale duplicate — should be deleted
├── tsconfig.app.json
├── components.json               # shadcn/ui component config
├── eslint.config.js
├── postcss.config.js
└── setup_*.sql                   # DB setup scripts at root (disorganized)
```

## Key Locations

| What | Where |
|---|---|
| Route definitions | `src/App.tsx` |
| Auth session | `src/integrations/supabase/client.ts` |
| DB types | `src/integrations/supabase/types.ts` |
| Core generation logic | `supabase/functions/generate-image/index.ts` |
| Vertex AI calls | `supabase/functions/_shared/fal-adapter.ts` |
| shadcn components | `src/components/ui/` |
| Data fetching hooks | `src/integrations/supabase/hooks/` |
| Global CSS | `src/index.css` |

## Naming Conventions

- **Pages:** PascalCase, noun or noun+page (`Generator.tsx`, `PricingPage.tsx`)
- **Components:** PascalCase, descriptive noun (`ColorVariantSelector.tsx`, `RequireAuth.tsx`)
- **Hooks:** camelCase with `use` prefix (`useCustomColors.ts`, `useCredits.ts`)
- **Utilities:** camelCase (`invokeEdgeFunctionWithRetry.ts`, `utils.ts`)
- **Path alias:** `@/` maps to `src/` (configured in `tsconfig.app.json` + Vite)
- **UI primitives:** live in `src/components/ui/` — shadcn/ui generated, generally not modified directly
