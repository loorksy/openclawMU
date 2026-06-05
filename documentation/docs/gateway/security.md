# Security

OpenClaw connects to real messaging surfaces. Treat inbound DMs as **untrusted input**.

## DM access defaults

Default behavior on Telegram / WhatsApp / Signal / iMessage / Microsoft Teams / Discord / Google Chat / Slack:

- **DM pairing** (`dmPolicy="pairing"` / `channels.discord.dmPolicy="pairing"` / `channels.slack.dmPolicy="pairing"`; legacy: `channels.discord.dm.policy`, `channels.slack.dm.policy`): unknown senders receive a short pairing code and the bot does not process their message.
- Approve with: `openclaw pairing approve <channel> <code>` (then the sender is added to a local allowlist store).
- Public inbound DMs require an explicit opt-in: set `dmPolicy="open"` and include `"*"` in the channel allowlist (`allowFrom` / `channels.discord.allowFrom` / `channels.slack.allowFrom`; legacy: `channels.discord.dm.allowFrom`, `channels.slack.dm.allowFrom`).

Run `openclaw doctor` to surface risky / misconfigured DM policies.

## Tokens & passwords

- `gateway.auth.token` / `gateway.auth.password` — file config.
- `OPENCLAW_GATEWAY_TOKEN` / `OPENCLAW_GATEWAY_PASSWORD` — env override.
- For multi-tenancy, tenants use `tenant:{tenantId}:{secret}` tokens that authorize against the tenant-allowed methods only.

Storage notes:

- Tenant tokens are SHA-256 hashed before storage.
- Comparisons use `crypto.timingSafeEqual()`.
- Tenant token rotation returns the plaintext exactly once.

## Sandboxing (multi-tenant)

- Bubblewrap (bwrap) backend for user-namespace isolation without root.
- Docker backend for full container isolation (cgroups, seccomp, AppArmor).
- Read-only root filesystem.
- Optional network namespace isolation.
- Resource limits via systemd-run.
- Symlink / path-traversal protection in tar extraction.

See [Multi-Tenancy](../multi-tenancy/index.md) for the sandbox configuration surface.

## Config overlay security (tenant)

- Admin-only keys prevent privilege escalation: `gateway`, `models`, `meta`.
- Nested key filtering for sensitive values: `agents.credentialsPath`, `env.shellEnv`.
- Deep merge prevents full config overwrite.

## Tailscale exposure

OpenClaw can auto-configure Tailscale **Serve** (tailnet-only) or **Funnel** (public) while the Gateway stays bound to loopback:

- `gateway.bind` must stay `loopback` when Serve / Funnel is enabled (OpenClaw enforces this).
- Serve can be forced to require a password by setting `gateway.auth.mode: "password"` or `gateway.auth.allowTailscale: false`.
- Funnel refuses to start unless `gateway.auth.mode: "password"` is set.
- Optional: `gateway.tailscale.resetOnExit` to undo Serve / Funnel on shutdown.

See [Tailscale](tailscale.md) for the full guide.

## macOS permissions (TCC)

The macOS app can run in **node mode** and advertises its capabilities + permission map over the Gateway WebSocket. Clients execute local actions via `node.invoke`:

- `system.run` runs a local command; set `needsScreenRecording: true` to require screen-recording permission (otherwise: `PERMISSION_MISSING`).
- `system.notify` posts a user notification and fails if notifications are denied.
- `canvas.*`, `camera.*`, `screen.record`, and `location.get` are routed via `node.invoke` and follow TCC permission status.

Elevated bash (host permissions) is separate from macOS TCC:

- Use `/elevated on|off` to toggle per-session elevated access when enabled + allowlisted.
- Gateway persists the per-session toggle via `sessions.patch` alongside `thinkingLevel`, `verboseLevel`, `model`, `sendPolicy`, and `groupActivation`.

## Reporting issues

See [Security disclosure](../reference/security.md).
