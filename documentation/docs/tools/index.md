# Tools & Skills

OpenClaw ships first-class tools the Pi agent can call: browser, canvas, nodes, cron, sessions, and channel actions. Skills extend the agent with bundled, managed, and workspace-installed capabilities.

## Built-in tools

- **Browser** — dedicated openclaw Chrome / Chromium with snapshots, actions, uploads, profiles. See [Browser](browser.md).
- **Canvas** — agent-driven visual workspace with A2UI push / reset, eval, snapshot.
- **Nodes** — camera snap / clip, screen record, `location.get`, notifications.
- **Cron + wakeups** — schedule jobs, webhook triggers, Gmail Pub/Sub.
- **Skills platform** — bundled, managed, and workspace skills with install gating + UI. See [Skills](skills.md).
- **Slash commands** — in-chat control surface. See [Slash commands](slash-commands.md).
- **Session tools** — `sessions_list`, `sessions_history`, `sessions_send` for cross-agent coordination.

## Agent to agent (sessions tools)

Use these to coordinate work across sessions without jumping between chat surfaces.

- `sessions_list` — discover active sessions (agents) and their metadata.
- `sessions_history` — fetch transcript logs for a session.
- `sessions_send` — message another session; optional reply-back ping-pong + announce step (`REPLY_SKIP`, `ANNOUNCE_SKIP`).

## Skills registry (ClawHub)

ClawHub is a minimal skill registry. With ClawHub enabled, the agent can search for skills automatically and pull in new ones as needed.

External: [clawhub.com](https://clawhub.com).

## See also

- [Browser](browser.md).
- [Skills](skills.md).
- [Slash commands](slash-commands.md).
