---
title: Admin Deployment
summary: Domain, reverse proxy, and environment variables
---

# Admin Deployment

## Environment variables

| Variable | Purpose |
| --- | --- |
| `OPENCLAW_ADMIN_DOMAIN` | Hostname that receives Admin UI + API |
| `OPENCLAW_ADMIN_PORT` | Optional dedicated listen port |
| `OPENCLAW_ADMIN_SESSION_SECRET` | Required to enable login |
| `OPENCLAW_ADMIN_SESSION_TTL` | Session TTL seconds (default `43200`) |
| `OPENCLAW_ADMIN_COOKIE_SECURE` | `1` in production HTTPS |
| `OPENCLAW_ADMIN_COOKIE_SAME_SITE` | `strict` (default), `lax`, or `none` |
| `OPENCLAW_ADMIN_ALLOWED_ORIGINS` | Extra CORS origins (comma-separated) |
| `OPENCLAW_ADMIN_BOOTSTRAP_EMAIL` | First-run Super Admin email |
| `OPENCLAW_ADMIN_BOOTSTRAP_PASSWORD` | First-run Super Admin password |

Equivalent config:

```json5
{
  gateway: {
    adminPlatform: {
      enabled: true,
      domain: "admin.example.com",
      sessionSecret: "set-via-env-preferred",
      cookieSecure: true,
      cookieSameSite: "strict",
      allowedOrigins: ["https://admin.example.com"],
    },
    trustedProxies: ["127.0.0.1"],
  },
}
```

## Nginx

```nginx
server {
  listen 443 ssl;
  server_name admin.example.com;
  location / {
    proxy_pass http://127.0.0.1:18789;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

Traefik and Cloudflare should forward the original `Host` and enable trusted proxies on the gateway.

## Local development

```bash
export OPENCLAW_ADMIN_DOMAIN=127.0.0.1
export OPENCLAW_ADMIN_PORT=19800
export OPENCLAW_ADMIN_SESSION_SECRET=dev-only-not-for-prod
export OPENCLAW_ADMIN_COOKIE_SECURE=0
openclaw admin bootstrap --email dev@example.com --password 'local-dev-pass'
openclaw gateway run
# open http://127.0.0.1:19800
```
