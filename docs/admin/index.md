---
title: Admin Platform
summary: Isolated Admin and Moderator console for OpenClawMU
---

# Admin Platform

The Admin Platform is a **separate** operator console for OpenClawMU. It is not a tab in Control UI and it does not accept tenant tokens.

Typical host split:

- Control UI / gateway / `/internal/v1` / WebSocket: `https://app.example.com`
- Admin Platform: `https://admin.example.com`

Do not use `/app/admin` as the isolation boundary.

## What it reuses

- Tenant registry, quotas, usage, and backups from `src/tenants/`
- System metrics from `src/infra/system-metrics.ts`
- Existing session stores (read/terminate)

## What it adds

- Independent staff authentication (Super Admin, Admin, Moderator)
- File-backed staff, sessions, and audit logs under `~/.openclaw/admin/`
- Host-gated HTTP API at `/admin/api/*`
- Dedicated Admin UI (not Control UI)

## Quick start

```bash
export OPENCLAW_ADMIN_DOMAIN=admin.example.com
export OPENCLAW_ADMIN_SESSION_SECRET="$(openssl rand -hex 32)"
export OPENCLAW_ADMIN_COOKIE_SECURE=1

openclaw admin bootstrap --email you@example.com --password 'a-long-password'
openclaw gateway run
```

Point a reverse proxy Host `admin.example.com` at the gateway port (or set `OPENCLAW_ADMIN_PORT` for a dedicated listen port).

See [Architecture](/admin/architecture), [Authentication](/admin/authentication), [RBAC](/admin/rbac), [Admin API](/admin/api), and [Deployment](/admin/deployment).
