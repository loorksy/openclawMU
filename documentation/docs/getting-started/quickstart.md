# Quick Start

Runtime: **Node 22 or later**.

## TL;DR

```bash
openclaw onboard --install-daemon

openclaw gateway --port 18789 --verbose

# Send a message
openclaw message send --to +1234567890 --message "Hello from OpenClaw"

# Talk to the assistant (optionally deliver back to any connected channel)
openclaw agent --message "Ship checklist" --thinking high
```

Upgrading? See [Updating](updating.md) (and run `openclaw doctor`).

## Open the dashboard

After the Gateway starts, open the browser Control UI:

- Local default: <http://127.0.0.1:18789/>
- Remote access: see [Remote](../gateway/remote.md) and [Tailscale](../gateway/tailscale.md).

## Optional configuration

Config lives at `~/.openclaw/openclaw.json`.

- If you **do nothing**, OpenClaw uses the bundled Pi binary in RPC mode with per-sender sessions.
- If you want to lock it down, start with `channels.whatsapp.allowFrom` and (for groups) mention rules.

Example:

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

See [Gateway configuration](../gateway/configuration.md) for the full surface.

## Multi-tenant quick start

```bash
# Create a tenant
openclaw tenants create demo

# Connect as tenant
OPENCLAW_GATEWAY_TOKEN="tenant:demo:xxxxx" openclaw chat
```

Full guide: [Multi-Tenancy](../multi-tenancy/index.md).
