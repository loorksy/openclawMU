# Concepts

Background reading for the pieces that make OpenClaw tick.

## Pages

- [Architecture](architecture.md) — the Gateway WebSocket network and the pieces around it.
- [Sessions & routing](sessions.md) — session model, group rules, multi-agent routing.
- [Models & failover](models.md) — provider selection, failover, OAuth, API keys.

## Reading list (in the upstream repo)

The repo's `docs/concepts/` directory covers more topics not duplicated here:

- `agent.md`, `agent-loop.md`, `agent-workspace.md` — the agent runtime.
- `architecture.md` — the canonical architecture reference.
- `compaction.md`, `context.md`, `memory.md` — context management.
- `messages.md`, `markdown-formatting.md` — message handling.
- `model-failover.md`, `model-providers.md`, `models.md` — model layer.
- `multi-agent.md` — multi-agent routing.
- `oauth.md` — provider OAuth flows.
- `presence.md`, `typing-indicators.md` — presence model.
- `queue.md`, `retry.md`, `streaming.md` — message lifecycle.
- `session*.md` — session lifecycle, pruning, the session tool.
- `system-prompt.md` — system prompt construction.
- `timezone.md`, `typebox.md`, `usage-tracking.md` — supporting concepts.

These read well in the source repo's `docs/concepts/` directory; this site curates the most important entry points.
