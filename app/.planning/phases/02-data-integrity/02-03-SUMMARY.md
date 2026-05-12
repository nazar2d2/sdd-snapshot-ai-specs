---
plan: 02-03
phase: 02-data-integrity
status: complete
commits:
  - ae90666
  - 2d53a2a
key-files:
  created: []
  modified:
    - src/integrations/supabase/hooks/useUserImages.ts
    - src/pages/Generator.tsx
---

## Summary

Closed the display-time URL signing blocker gap from 02-VERIFICATION.

### What was built

**Task 1 — `extractPathFromUrl` (useUserImages.ts):** Updated to handle three URL formats:
1. Bare storage paths (`jobs/{jobId}/view/variant.png`) — returned as-is (new format from plan 02-02)
2. Supabase signed/public URLs containing `generated-images/` — path extracted after bucket name (legacy format)
3. Other `https://` URLs — returns null (external, not our storage)

Previously, bare paths hit the `if (idx === -1) return null` early-exit and were silently dropped, causing images to never be signed and fail to render.

**Task 2 — `Generator.tsx`:** Wired URL signing at the render boundary using the same pattern as `MyImages.tsx`:
- Imported `extractPathFromUrl` and `useSignedUrls` from `useUserImages`
- Added `useMemo` / `useCallback` to React imports
- Added `imagePaths` computation (deduped storage paths from visible images)
- Added `useSignedUrls(imagePaths)` → `signedMap`
- Added `resolveImageUrl` callback (path → signed URL via signedMap)
- Applied at render: `images={images.map(img => ({ ...img, image: resolveImageUrl(img.image) }))}`
- Applied to loading thumbnails: `partialImages={partialImages.map(...)}`
- Raw `result_url` values remain in state (signing happens at display time only)

### Deviations

None — implementation matched the plan exactly.

### Self-Check: PASSED

- `grep -c '!url.startsWith("https://")' src/integrations/supabase/hooks/useUserImages.ts` → 1 ✓
- `grep -c "useSignedUrls" src/pages/Generator.tsx` → 2 ✓
- `grep -c "extractPathFromUrl" src/pages/Generator.tsx` → 3 ✓
- `grep -c "resolveImageUrl" src/pages/Generator.tsx` → 3 ✓
- Lines 248 and 327 still assign raw `result_url` to `image` (signing at render, not fetch) ✓
- `grep 'from "@/integrations/supabase/hooks/useUserImages"' src/pages/Generator.tsx` → 1 line ✓
