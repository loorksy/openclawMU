---
title: Admin Architecture
summary: How the Admin Platform sits next to Gateway and Control UI
---

# Admin Architecture

```
Internet
  ├── app.example.com        → Gateway + Control UI + tenant APIs
  └── admin.example.com      → Admin UI + /admin/api
           └── same OpenClawMU process (Host match)
               or dedicated OPENCLAW_ADMIN_PORT
```

## Request flow

1. WebSocket upgrades are left to the gateway (Admin never consumes `Upgrade: websocket`).
2. If `Host` (or trusted `X-Forwarded-Host`) matches `OPENCLAW_ADMIN_DOMAIN`, or the dedicated admin port is used, the request is handled by Admin and never reaches Control UI.
3. `app.example.com` and any other host keep existing Control UI, `/internal/v1`, and WebSocket behavior.
4. `/admin/api/*` requires an Admin session cookie plus CSRF on mutations.
5. Handlers call existing tenant/usage/session modules. They do not reimplement isolation.

## Persistence

| Data           | Path                                              |
| -------------- | ------------------------------------------------- |
| Staff          | `~/.openclaw/admin/staff.json` (mode `0600`)      |
| Admin sessions | `~/.openclaw/admin/sessions.json` (hashed tokens) |
| Audit log      | `~/.openclaw/admin/audit.jsonl` (append-only)     |
| Tenants        | existing `~/.openclaw/tenants.json`               |

No SQL database is introduced. This matches the OpenClawMU deployment model.

## Isolation

- Tenant tokens cannot authenticate to `/admin/api`.
- Admin staff can see every tenant (cross-tenant is the product requirement).
- Moderators cannot delete tenants, manage Super Admins, or write quotas.
- Control UI origin is not granted Admin CORS.
