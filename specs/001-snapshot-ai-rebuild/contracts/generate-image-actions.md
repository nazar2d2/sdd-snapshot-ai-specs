# Contract: generate-image Edge Function Actions

**Function**: `supabase/functions/generate-image/index.ts`
**Auth**: JWT required (verify_jwt = true) except `OPTIONS` preflight

---

## Action: `create_job`

### Request
```json
{
  "action": "create_job",
  "niche": "fashion" | "home_decor",
  "model": "gemini-2.5-flash-image",
  "productConfig": { ... },
  "colorConfig": { ... }
}
```

### Response (success)
```json
{
  "jobId": "uuid",
  "taskCount": 4
}
```

### Handler
After Phase 3: delegated to `handleCreateJob(req, user)`.

---

## Action: `work`

### Request
```json
{
  "action": "work",
  "jobId": "uuid"
}
```

### Response (success — task completed)
```json
{
  "status": "completed",
  "taskId": "uuid",
  "storagePath": "jobs/{jobId}/{view}/{variant}.png"
}
```

### Response (anchor not ready — NEW in Phase 3)
```json
{
  "status": "anchor_pending",
  "retryAfterMs": 3000,
  "message": "Anchor image is still generating. Retry after the specified delay."
}
```

### Response (no tasks available)
```json
{
  "status": "idle"
}
```

### Handler
After Phase 3: delegated to `handleWork(req, user)`.

---

## Action: `get_results`

### Request
```json
{
  "action": "get_results",
  "jobId": "uuid"
}
```

### Response
```json
{
  "jobId": "uuid",
  "status": "running" | "completed" | "failed",
  "tasks": [
    {
      "id": "uuid",
      "view": "front",
      "variant": "color_1",
      "status": "completed",
      "signedUrl": "https://..."
    }
  ]
}
```

Note: `signedUrl` is generated on-demand from the stored `result_url` path — never stored.

### Handler
After Phase 3: delegated to `handleGetResults(req, user)`.
