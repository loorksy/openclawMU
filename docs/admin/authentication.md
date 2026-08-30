---
title: Admin Authentication
summary: Staff login, cookies, CSRF, and bootstrap
---

# Admin Authentication

Admin auth is **not** the gateway token and **not** a `tenant:{id}:{secret}` token.

## Bootstrap

First Super Admin:

```bash
openclaw admin bootstrap --email you@example.com --password 'at-least-12-chars'
```

Alternatively, on first request, if the staff file is empty:

- `OPENCLAW_ADMIN_BOOTSTRAP_EMAIL`
- `OPENCLAW_ADMIN_BOOTSTRAP_PASSWORD`

Unset bootstrap password after the first login.

## Session

- Cookie: `openclaw_admin_session` (HttpOnly, host-only, configurable `Secure` / `SameSite`)
- Token stored as SHA-256
- CSRF token returned by `GET /admin/api/auth/session` and required as `X-Admin-CSRF` on mutations
- Logout revokes the server session

## Passwords

Staff passwords are hashed with Node `scrypt`. They are never stored or logged in plaintext.

## Optional 2FA

Staff records can store an encrypted TOTP secret (`totpEnabled`). When enabled, login requires a 6+ character `totp` field. Full authenticator enrollment UI can be added without changing the session model.
