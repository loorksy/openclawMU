# Configuration

Gateway configuration is keyed in `~/.openclaw/openclaw.json` (or `openclaw.json5`). The wizard creates and maintains this file; you can also edit it directly.

## Defaults

- No config required — OpenClaw uses the bundled Pi binary in RPC mode with per-sender sessions.
- Bind defaults to `loopback`.
- Auth is required by default. Set via `gateway.auth.token` / `gateway.auth.password` or the matching env vars.

## Minimal example

```json5
{
  channels: {
    whatsapp: {
      allowFrom: ["+15555550123"],
      groups: { "*": { requireMention: true } },
    },
  },
  messages: { groupChat: { mentionPatterns: ["@openclaw"] } },
}
```

## Auth

| Setting                    | Description                                |
| -------------------------- | ------------------------------------------ |
| `gateway.auth.token`       | Static bearer token for the Gateway.       |
| `gateway.auth.password`    | Shared password for password-mode auth.    |
| `gateway.auth.mode`        | `token` / `password` / `tailscale` / etc.  |
| `gateway.auth.allowTailscale` | Allow Tailscale identity-header auth.   |

Environment variables `OPENCLAW_GATEWAY_TOKEN` / `OPENCLAW_GATEWAY_PASSWORD` override file config.

## Bind and port

| Setting              | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `gateway.bind`       | `loopback` (default) or another bind mode.           |
| `gateway.port`       | Default `18789`.                                     |
| `gateway.tailscale.mode` | `off` / `serve` / `funnel` (see [Tailscale](tailscale.md)). |

When Tailscale Serve or Funnel is enabled, OpenClaw enforces `loopback` bind.

## Reload

Gateway config reload watches the active config file (resolved from profile/state defaults, or `OPENCLAW_CONFIG_PATH` when set). Default reload mode is `gateway.reload.mode="hybrid"`.

## Multi-tenancy

```json5
{
  gateway: {
    multiTenant: true,                // auto-enables when tenant tokens are used
    controlPlaneToken: "secret-token" // internal HTTP API auth
  }
}
```

See [Multi-Tenancy](../multi-tenancy/index.md) for the full surface.

## Channels

Channel config lives under `channels.<name>`. Common keys:

- `channels.<name>.allowFrom` — sender allowlist.
- `channels.<name>.dmPolicy` — `pairing` (default) or `open`.
- `channels.<name>.groups` — group routing and mention rules.

Channel-specific options are documented under [Channels](../channels/index.md).

## See also

- [Security](security.md) — token, DM policy, sandbox isolation.
- [Doctor](doctor.md) — validates the config and migrates older shapes.
- [Remote](remote.md) — exposing the Gateway off-box safely.
