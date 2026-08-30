---
title: Admin API
summary: Host-gated Admin REST surface
---

# Admin API

All routes are served only on the Admin Host (or dedicated admin port). Prefix: `/admin/api`.

| Method | Path | Permission |
| --- | --- | --- |
| POST | `/auth/login` | public |
| POST | `/auth/logout` | session |
| GET | `/auth/session` | session |
| GET | `/dashboard` | `system.read` + `tenants.read` |
| GET/POST | `/tenants` | `tenants.read` / `tenants.create` |
| GET/PATCH/DELETE | `/tenants/:id` | read / update / delete |
| POST | `/tenants/:id/rotate` | `users.write` |
| GET | `/users` | `users.read` |
| GET | `/sessions` | `sessions.read` |
| DELETE | `/sessions/:key` | `sessions.terminate` |
| GET | `/usage` | `usage.read` |
| GET/PATCH | `/quotas`, `/quotas/:id` | `quotas.read` / `quotas.write` |
| GET | `/system` | `system.read` |
| GET | `/logs` | `logs.read` |
| GET | `/audit` | `audit.read` |
| GET/POST/PATCH | `/staff` | staff permissions |
| GET | `/health` | public liveness |

Mutations require `X-Admin-CSRF`. Cookies are credentials-only; CORS allowlists configured origins (never `*`).
