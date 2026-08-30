---
title: Admin Troubleshooting
summary: Common Admin Platform failures
---

# Admin Troubleshooting

## 503 OPENCLAW_ADMIN_SESSION_SECRET is required

Set a long random secret before enabling login.

## Login page never appears on the gateway port

Admin UI is Host-gated. Use `OPENCLAW_ADMIN_DOMAIN` matching the browser host, or `OPENCLAW_ADMIN_PORT`.

## 401 CSRF validation failed

Call `GET /admin/api/auth/session` and send `X-Admin-CSRF` on POST/PATCH/DELETE.

## Staff already initialized

`openclaw admin bootstrap` only works on an empty staff file. Add more accounts from `/staff`.

## Tenant token cannot open Admin

Expected. Create a staff account instead.
