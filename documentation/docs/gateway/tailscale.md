# Tailscale

OpenClaw can auto-configure Tailscale **Serve** (tailnet-only) or **Funnel** (public) while the Gateway stays bound to loopback.

Configure `gateway.tailscale.mode`:

- `off` — no Tailscale automation (default).
- `serve` — tailnet-only HTTPS via `tailscale serve` (uses Tailscale identity headers by default).
- `funnel` — public HTTPS via `tailscale funnel` (requires shared password auth).

## Notes & constraints

- `gateway.bind` must stay `loopback` when Serve / Funnel is enabled (OpenClaw enforces this).
- Serve can be forced to require a password by setting `gateway.auth.mode: "password"` or `gateway.auth.allowTailscale: false`.
- Funnel refuses to start unless `gateway.auth.mode: "password"` is set.
- Optional: `gateway.tailscale.resetOnExit` to undo Serve / Funnel on shutdown.

## Choosing a mode

| Mode     | Reachable from           | Auth                                  |
| -------- | ------------------------ | ------------------------------------- |
| `off`    | localhost only           | Token / password                      |
| `serve`  | tailnet members          | Tailscale identity (or password)      |
| `funnel` | public internet (HTTPS)  | Password required                     |

## See also

- [Security](security.md).
- [Remote access](remote.md).
