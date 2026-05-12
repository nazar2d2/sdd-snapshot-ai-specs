# Conventions
<!-- last_mapped_commit: see git log -->
<!-- mapped: 2026-05-08 -->

## Language & Runtime

- **TypeScript** throughout — strict mode, `tsconfig.app.json`
- **ESLint** with `typescript-eslint` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`
- No Prettier config found — formatting enforced by ESLint rules only
- Module system: ESM (`"type": "module"` in package.json)

## Component Patterns

**Functional components only** — no class components observed.

```tsx
// Standard component pattern
export function ComponentName({ prop1, prop2 }: Props) {
  return <div>...</div>;
}

// Default export for pages
export default function PageName() { ... }

// Named export for shared components
export function SharedComponent() { ... }
```

- Props typed inline as `{ prop: Type }` or via an interface above the component
- `React.FC` type is NOT used — prefer plain function signatures
- Path alias `@/` used for all internal imports (`@/components/...`, `@/lib/...`)

## Styling

- **Tailwind CSS** (v3) — utility classes throughout, no CSS modules
- **shadcn/ui** components as primitives (`src/components/ui/`) — Radix UI based, styled with Tailwind
- `cn()` helper (`src/lib/utils.ts`) via `clsx` + `tailwind-merge` for conditional class merging
- `class-variance-authority` (CVA) used for component variants in shadcn components
- Animations: `framer-motion` for complex animations, `tailwindcss-animate` for simple ones, `gsap`/`animejs` in specific places
- `next-themes` for theme support

```ts
// cn() pattern
import { cn } from "@/lib/utils";
className={cn("base-class", condition && "conditional-class", className)}
```

## State Management

- **TanStack Query v5** for all server/async state — queries and mutations
- **`useState` + `useCallback`** for local component state and stable callbacks
- **`useEffect`** for side effects (auth checks, data loading on mount)
- No Redux, Zustand, or other global state store — Supabase auth session and query cache serve this role

## Custom Hook Pattern

```ts
export function useResourceName() {
  const [data, setData] = useState<Type[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const doAction = useCallback(async (param: string): Promise<boolean> => {
    try {
      // Supabase call
      return true;
    } catch (err) {
      console.error("Error doing action:", err);
      return false;
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return { data, isLoading, doAction };
}
```

- Hooks return plain object (not array) — named fields
- Async hooks return `boolean` for success/failure
- Errors logged with `console.error()` — no centralized error reporting

## Error Handling

- **Try/catch** in async functions
- Errors logged to `console.error()` — no crash reporting or Sentry
- Supabase errors destructured: `const { data, error } = await supabase.from(...)`
- Error state typically handled with early return (`if (error) { console.error(...); return; }`)
- Silent error swallowing present in several places (known issue — see CONCERNS.md)
- Toast notifications (`sonner`) used for user-visible errors

## Supabase Usage

```ts
// Direct client calls from hooks
import { supabase } from "@/integrations/supabase/client";

// Read
const { data, error } = await supabase
  .from("table_name")
  .select("col1, col2")
  .eq("user_id", user.id);

// Auth
const { data: { user } } = await supabase.auth.getUser();
```

- DB types imported from `src/integrations/supabase/types.ts` (auto-generated, do not edit)
- `as any` casts present in a few places (known type alignment bug)

## Edge Functions (Deno)

- Located in `supabase/functions/`
- Shared utilities in `supabase/functions/_shared/`
- Actions dispatched via `action` field in request body (not separate endpoints)
- CORS headers set on all responses

## File Organization Rules

- One component per file
- Co-locate hooks with their primary consumer where possible, or in `src/hooks/` or `src/integrations/supabase/hooks/`
- `src/components/ui/` — shadcn primitives only, not modified directly
- `src/pages/` — route-level components only (not reused elsewhere)
