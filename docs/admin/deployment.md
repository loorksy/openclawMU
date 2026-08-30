---
title: Admin Deployment
summary: Domain split, reverse proxy, HTTPS, and environment variables
---

# Admin Deployment

Admin is a **separate hostname**, not a `/app/admin` route.

| Host                        | What it serves                                 |
| --------------------------- | ---------------------------------------------- |
| `https://app.example.com`   | Gateway, Control UI, `/internal/v1`, WebSocket |
| `https://admin.example.com` | Admin UI + `/admin/api` only                   |

Any other `Host` does **not** receive Admin API. The gateway process may still serve Control UI and existing APIs on those hosts.

## Environment variables

| Variable                            | Purpose                               |
| ----------------------------------- | ------------------------------------- |
| `OPENCLAW_ADMIN_DOMAIN`             | Hostname that receives Admin UI + API |
| `OPENCLAW_ADMIN_PORT`               | Optional dedicated listen port        |
| `OPENCLAW_ADMIN_SESSION_SECRET`     | Required to enable login              |
| `OPENCLAW_ADMIN_SESSION_TTL`        | Session TTL seconds (default `43200`) |
| `OPENCLAW_ADMIN_COOKIE_SECURE`      | `1` in production HTTPS               |
| `OPENCLAW_ADMIN_COOKIE_SAME_SITE`   | `strict` (default), `lax`, or `none`  |
| `OPENCLAW_ADMIN_ALLOWED_ORIGINS`    | Extra CORS origins (comma-separated)  |
| `OPENCLAW_ADMIN_BOOTSTRAP_EMAIL`    | First-run Super Admin email           |
| `OPENCLAW_ADMIN_BOOTSTRAP_PASSWORD` | First-run Super Admin password        |

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

## Forwarded headers

Admin uses `Host` by default.

`X-Forwarded-Host` and `X-Forwarded-Proto` are honored **only** when the peer IP is listed in `gateway.trustedProxies`. Untrusted clients cannot spoof the Admin hostname.

Set `OPENCLAW_ADMIN_COOKIE_SECURE=1` behind HTTPS. If a trusted proxy sends `X-Forwarded-Proto: https`, cookies also get `Secure`.

## Nginx (production)

Terminate TLS at the proxy. Forward the original host. Restrict `trustedProxies` to the proxy IP.

```nginx
# app.example.com — existing OpenClawMU / Control UI
server {
  listen 443 ssl;
  server_name app.example.com;

  location / {
    proxy_pass http://127.0.0.1:18789;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
  }
}

# admin.example.com — Admin Platform only
server {
  listen 443 ssl;
  server_name admin.example.com;

  location / {
    proxy_pass http://127.0.0.1:18789;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Cloudflare or Traefik should keep the public hostname in `Host` (or `X-Forwarded-Host` plus `gateway.trustedProxies` set to the proxy). Do not point the Admin origin at `app.example.com`.

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

The dedicated admin port does not accept WebSocket upgrades. Use the main gateway port for Control UI WebSocket.
