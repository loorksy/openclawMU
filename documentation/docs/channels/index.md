# Channels

OpenClaw runs as a multi-channel inbox. One Gateway process serves multiple chat surfaces simultaneously.

## Supported channels

- **WhatsApp** (Baileys).
- **Telegram** (grammY).
- **Slack** (Bolt).
- **Discord** (discord.js).
- **Google Chat** (Chat API).
- **Signal** (signal-cli).
- **BlueBubbles** — iMessage, recommended.
- **iMessage** — legacy `imsg` driver.
- **Microsoft Teams** — extension.
- **Matrix** — extension.
- **Zalo** — extension.
- **Zalo Personal** — extension.
- **WebChat** — served by the Gateway.

Extension packages add channels like Mattermost, Feishu, Line, Nextcloud Talk, Twitch, IRC, Nostr, Tlon, and more. See the upstream `docs/channels/` directory for per-channel setup notes.

## Routing

- Inbound channels, accounts, and peers can be routed to isolated agents (workspaces + per-agent sessions).
- Per-channel chunking, mention gating, and reply tags for group routing.

See [DM policy & pairing](pairing.md) for inbound DM controls and [Group routing](groups.md) for group rules.

## Per-channel configuration

Channel config lives under `channels.<name>` in `openclaw.json`. Common keys:

- `channels.<name>.allowFrom` — sender allowlist.
- `channels.<name>.dmPolicy` — `pairing` (default) or `open`.
- `channels.<name>.groups` — group routing and mention rules.

The wizard (`openclaw onboard`) walks through per-channel pairing for the major channels.

## Channel CLI

```bash
openclaw channels login     # Interactive pairing
openclaw channels status    # Per-channel status
openclaw channels start <channel>
openclaw channels stop <channel>
openclaw channels logout <channel>
```

## See also

- [DM policy & pairing](pairing.md).
- [Group routing](groups.md).
- [Gateway security](../gateway/security.md).
