# Contract: Admin Edge Functions

All admin edge functions now use `buildCorsHeaders()` from `_shared/cors.ts`.
`Access-Control-Allow-Origin` will be `SITE_URL` env var value (NOT `*`).

---

## admin-create-user

**Auth**: JWT + `is_admin()` RPC check
**CORS**: SITE_URL-restricted

### Request
```json
{ "email": "string", "password": "string", "credits": 100 }
```

### Response
```json
{ "userId": "uuid" }
```

---

## admin-delete-user

**Auth**: JWT + `is_admin()` RPC check
**CORS**: SITE_URL-restricted

### Request
```json
{ "userId": "uuid" }
```

### Response
```json
{ "success": true }
```

---

## admin-purchases

**Auth**: JWT + `is_admin()` RPC check
**CORS**: SITE_URL-restricted

### Request
```json
{ "limit": 50, "offset": 0 }
```

### Response
```json
{ "purchases": [...], "total": 120 }
```

---

## admin-whitelist

**Auth**: JWT + `is_admin()` RPC check
**CORS**: SITE_URL-restricted

### Request
```json
{ "action": "add" | "remove", "email": "string" }
```

### Response
```json
{ "success": true }
```
