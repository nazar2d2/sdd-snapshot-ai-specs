---
status: partial
phase: 02-data-integrity
source: [02-VERIFICATION.md]
started: 2026-05-10T00:00:00Z
updated: 2026-05-10T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Legacy signed URL backward-compatibility in MyImages.tsx

expected: The MyImages page loads correctly for DB accounts that have `result_url` records with old Supabase signed URLs (containing `token=` and `generated-images/` in the URL). Images should render correctly — `extractPathFromUrl` extracts the object path via the `generated-images/` marker, path is fed to `useSignedUrls`, and a fresh signed URL is returned.
result: [pending]

### 2. Generator.tsx partial results during active generation

expected: Starting a generation job and observing the loading state shows thumbnails appearing progressively as tasks complete (not broken icons). Bare storage paths from `result_url` are signed and rendered as valid image URLs in the loading state thumbnails.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
