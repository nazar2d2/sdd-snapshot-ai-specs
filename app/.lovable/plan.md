# Switch fully to Supabase project `phkwivrcuuvzpgzvvmkv`

## Current state

The runtime is already pointing at the right project:
- `src/integrations/supabase/client.ts` hardcodes `PROJECT_REF = "phkwivrcuuvzpgzvvmkv"`
- `supabase/config.toml` → `project_id = "phkwivrcuuvzpgzvvmkv"`
- `supabase/.temp/linked-project.json` → `phkwivrcuuvzpgzvvmkv`
- GitHub Actions deploy → `--project-ref phkwivrcuuvzpgzvvmkv`
- All email templates load the logo from `phkwivrcuuvzpgzvvmkv.supabase.co`
- Edge function secret `SUPABASE_URL` is set to `https://phkwivrcuuvzpgzvvmkv.supabase.co`

Remaining legacy `mqgtvfhdpoktgsepnfxi` references:
1. `.env` — stale `VITE_SUPABASE_PROJECT_ID` and `VITE_SUPABASE_URL` still point to the legacy ref (the publishable key is already the new one). These vars are unused by `client.ts`, but they're misleading.
2. `src/lib/purge-legacy-supabase-storage.ts` — intentionally references the legacy ref to wipe stale auth tokens from users' browsers. **Keep as-is.**
3. `.planning/codebase/INTEGRATIONS.md` and `.planning/codebase/STACK.md` — docs mention the old project ID.
4. Lovable's internal cloud-project metadata still lists the legacy ref + a different anon key. This is managed by the Lovable Cloud connection itself, not by files in the repo.

## Changes

### File: `.planning/codebase/INTEGRATIONS.md`
Update `project ID: mqgtvfhdpoktgsepnfxi` → `phkwivrcuuvzpgzvvmkv`.

### File: `.planning/codebase/STACK.md`
Same swap.

### File: `.env`
Note: `.env` is auto-managed by the Lovable Cloud integration and may be rewritten. I'll attempt to align the two stale lines:
- `VITE_SUPABASE_PROJECT_ID="phkwivrcuuvzpgzvvmkv"`
- `VITE_SUPABASE_URL="https://phkwivrcuuvzpgzvvmkv.supabase.co"`

If the integration keeps overwriting these, the runtime is unaffected (client.ts ignores them) — but you may want to fully disconnect the legacy Lovable Cloud link from **Connectors → Lovable Cloud** so the metadata stops being pushed back.

### Files: `src/lib/purge-legacy-supabase-storage.ts`
**No change** — still needed to clear old `sb-mqgtvfhdpoktgsepnfxi-auth-token` entries from returning users' browsers.

## Out of scope

- Data migration between the two Supabase projects (none needed — already running on the new one).
- Changing the hardcoded `PROJECT_REF` (already correct).
- Disconnecting Lovable Cloud — that's a Connectors UI action you'd take, not a code change.
