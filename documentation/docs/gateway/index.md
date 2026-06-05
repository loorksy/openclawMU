# Gateway

The Gateway is the single control plane for OpenClaw: one always-on process for routing, channel connections, sessions, tools, and events.

## Runtime model

- One always-on process for routing, control plane, and channel connections.
- Single multiplexed port for:
    - WebSocket control / RPC.
    - HTTP APIs (OpenAI-compatible, Responses, tools invoke).
    - Control UI and hooks.
- Default bind mode: `loopback`.
- Auth required by default (`gateway.auth.token` / `gateway.auth.password`, or `OPENCLAW_GATEWAY_TOKEN` / `OPENCLAW_GATEWAY_PASSWORD`).

### Port and bind precedence

| Setting      | Resolution order                                              |
| ------------ | ------------------------------------------------------------- |
| Gateway port | `--port` → `OPENCLAW_GATEWAY_PORT` → `gateway.port` → `18789` |
| Bind mode    | CLI/override → `gateway.bind` → `loopback`                    |

## 5-minute local startup

### Start the Gateway

```bash
openclaw gateway --port 18789
# debug/trace mirrored to stdio
openclaw gateway --port 18789 --verbose
# force-kill listener on selected port, then start
openclaw gateway --force
```

### Verify service health

```bash
openclaw gateway status
openclaw status
openclaw logs --follow
```

Healthy baseline: `Runtime: running` and `RPC probe: ok`.

### Validate channel readiness

```bash
openclaw channels status --probe
```

## Sections

- [Configuration](configuration.md) — config schema, reload modes, examples.
- [Security](security.md) — tokens, DM policy, allowlists, sandboxing.
- [Remote access](remote.md) — SSH tunnels, remote gateway pattern.
- [Tailscale](tailscale.md) — Serve / Funnel exposure with loopback bind.
- [Doctor](doctor.md) — repair, migration, and validation tool.

## Key subsystems

- **Gateway WebSocket network** — single WS control plane for clients, tools, and events.
- **Tailscale exposure** — Serve / Funnel for the Gateway dashboard + WS.
- **Browser control** — openclaw-managed Chrome/Chromium with CDP control.
- **Canvas + A2UI** — agent-driven visual workspace.
- **Voice Wake + Talk Mode** — always-on speech and continuous conversation.
- **Nodes** — Canvas, camera snap/clip, screen record, `location.get`, notifications, plus macOS-only `system.run` / `system.notify`.
