---
title: Admin Security
summary: Attack-surface rules for the Admin Platform
---

# Admin Security

- Backend checks session, role, permission, and resource on every API call.
- Tenant tokens are never accepted as Admin credentials.
- Cookies are host-only and not shared with `app.example.com`.
- CORS never uses `Access-Control-Allow-Origin: *`.
- Audit log is append-only and not editable from the UI.
- Passwords, tokens, and secrets are not written to audit metadata.
- Rate limiting applies to Admin login (loopback is not exempt).
- Admin Host requests never fall through to Control UI.
