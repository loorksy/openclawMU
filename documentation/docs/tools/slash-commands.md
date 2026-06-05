# Slash Commands

OpenClaw exposes an in-chat control surface through slash commands. Send these in WhatsApp / Telegram / Slack / Google Chat / Microsoft Teams / WebChat (group commands are owner-only).

The canonical list lives in the upstream `README.md` under "Chat commands" and in `docs/tools/slash-commands.md` in the repo. Highlights:

## Session controls

- **Elevated bash** — `/elevated on|off` toggles per-session elevated access when enabled and allowlisted. Gateway persists the per-session toggle via `sessions.patch` alongside `thinkingLevel`, `verboseLevel`, `model`, `sendPolicy`, and `groupActivation`.

## Talk Mode and Voice Wake

Slash commands toggle Talk Mode and configure Voice Wake when used in the right surface. See [Nodes & Platforms](../platforms/index.md).

## Owner-only group commands

In groups, control commands are owner-only by default. Mention-gating and group activation rules still apply — see [Group routing](../channels/groups.md).

## See also

- [Browser](browser.md).
- [Skills](skills.md).
