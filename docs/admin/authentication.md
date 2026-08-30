---
title: Admin Authentication
summary: Staff login, cookies, CSRF, and bootstrap
---

# Admin Authentication

Admin auth is **not** the gateway token and **not** a `tenant:{id}:{secret}` token.

## Bootstrap

First Super Admin (CLI, recommended):

```bash
openclaw admin bootstrap --email you@example.com --password 'at-least-12-chars'
```

Alternatively, on the first `/admin/api` request after the staff file is empty:

- `OPENCLAW_ADMIN_BOOTSTRAP_EMAIL`
- `OPENCLAW_ADMIN_BOOTSTRAP_PASSWORD`

Bootstrap is **one-shot**. If any staff account already exists, env bootstrap is ignored and cannot overwrite accounts. Unset the bootstrap password after the first login. There is no default account.

## Session

- Cookie: `openclaw_admin_session` (HttpOnly, host-only, no `Domain=` attribute)
- Cookie `Secure` / `SameSite` from config (`strict` + `Secure` in production)
- Raw token is never stored. The file keeps an HMAC-SHA-256 of the token keyed by `OPENCLAW_ADMIN_SESSION_SECRET`
- Login always issues a **new** session id (no session fixation)
- Concurrent browser sessions for the same staff account are allowed until TTL or logout
- Logout revokes that server session and clears the cookie
- Expired sessions are pruned and rejected

## CSRF

`GET /admin/api/auth/session` returns `csrfToken`. Every POST/PATCH/DELETE (except login) requires `X-Admin-CSRF`. Login is origin-checked when an `Origin` header is present.

## CORS

Credentials are allowed only for configured origins. `Access-Control-Allow-Origin: *` is never set. `app.example.com` is not granted Admin CORS unless you add it explicitly (do not).

## Passwords

Staff passwords are hashed with Node `scrypt`. They are never stored or logged in plaintext.

## Two-factor authentication

TOTP / 2FA is **not implemented**. Staff password is the only factor. Treat this as future work; do not set fields or UI that imply 2FA is active.
