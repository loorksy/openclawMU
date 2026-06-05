# Sessions & Routing

## Session model

- `main` — the default session for direct chats.
- **Group isolation** — group messages get their own sessions, gated by mention rules and reply tags.
- **Activation modes** — control when the agent responds (always, mention, reply, etc.).
- **Queue modes** — control how messages stack up while a previous turn is in flight.
- **Reply-back** — replies to the agent's own messages re-activate the relevant session.

## Multi-agent routing

Inbound channels / accounts / peers can be routed to isolated agents (workspaces + per-agent sessions). Use this to keep work, personal, and per-customer agents separate while still sharing a single Gateway.

## Cross-agent coordination

The session tools (`sessions_list`, `sessions_history`, `sessions_send`) let agents discover and message each other without jumping between chat surfaces. `sessions_send` supports optional reply-back ping-pong + announce step (`REPLY_SKIP`, `ANNOUNCE_SKIP`).

## Pruning

Sessions are pruned on a schedule to keep storage bounded. See `docs/concepts/session-pruning.md` in the repo for the rules.

## Multi-tenant sessions

In OpenClawMU, all tenant session keys are prefixed with `tenant:{tenantId}:`. The Gateway enforces this at both the WebSocket and HTTP entry points. Tenants can `sessions.list` and `sessions.preview` their own sessions only; modification methods (`patch`, `reset`, `delete`, `compact`) are admin-only.

See [Multi-Tenancy → Feature comparison](../multi-tenancy/feature-comparison.md).

## See also

- [Architecture](architecture.md).
- [Group routing](../channels/groups.md).
- [Multi-Tenancy](../multi-tenancy/index.md).
