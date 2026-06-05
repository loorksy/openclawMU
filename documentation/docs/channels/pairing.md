# DM Policy & Pairing

OpenClaw connects to real messaging surfaces. Treat inbound DMs as **untrusted input**.

## Default DM policy

Default behavior on Telegram / WhatsApp / Signal / iMessage / Microsoft Teams / Discord / Google Chat / Slack:

- **DM pairing** (`dmPolicy="pairing"`): unknown senders receive a short pairing code and the bot does not process their message.
- Approve a sender:

  ```bash
  openclaw pairing approve <channel> <code>
  ```

  The sender is then added to a local allowlist store.
- Public inbound DMs require an explicit opt-in: set `dmPolicy="open"` and include `"*"` in the channel allowlist (`allowFrom`).

## Channel-specific keys

Per-channel overrides use the same keys under `channels.<name>`:

- `channels.discord.dmPolicy` (legacy: `channels.discord.dm.policy`).
- `channels.slack.dmPolicy` (legacy: `channels.slack.dm.policy`).
- `channels.discord.allowFrom` (legacy: `channels.discord.dm.allowFrom`).
- `channels.slack.allowFrom` (legacy: `channels.slack.dm.allowFrom`).

## Validating policy

```bash
openclaw doctor
```

Doctor surfaces risky / misconfigured DM policies (open DMs, missing allowlists, legacy keys).

## Approving a sender

When an unknown sender DMs the bot, they receive a pairing code. The operator approves with:

```bash
openclaw pairing approve <channel> <code>
```

After approval, the sender is persisted in the local allowlist store and future messages are processed normally.

## See also

- [Group routing](groups.md).
- [Gateway security](../gateway/security.md).
