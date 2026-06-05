# Architecture

## High-level flow

```
WhatsApp / Telegram / Slack / Discord / Google Chat / Signal / iMessage / BlueBubbles / Microsoft Teams / Matrix / Zalo / Zalo Personal / WebChat
               │
               ▼
┌───────────────────────────────┐
│            Gateway            │
│       (control plane)         │
│     ws://127.0.0.1:18789      │
└──────────────┬────────────────┘
               │
               ├─ Pi agent (RPC)
               ├─ CLI (openclaw …)
               ├─ WebChat UI
               ├─ macOS app
               └─ iOS / Android nodes
```

The Gateway is the single source of truth for sessions, routing, and channel connections.

## Subsystems

- **Gateway WebSocket network** — single WS control plane for clients, tools, and events (plus ops: Gateway runbook).
- **Tailscale exposure** — Serve / Funnel for the Gateway dashboard + WS.
- **Browser control** — openclaw-managed Chrome / Chromium with CDP control.
- **Canvas + A2UI** — agent-driven visual workspace.
- **Voice Wake + Talk Mode** — always-on speech and continuous conversation.
- **Nodes** — Canvas, camera snap / clip, screen record, `location.get`, notifications, plus macOS-only `system.run` / `system.notify`.

## Runtime

- One always-on process for routing, control plane, and channel connections.
- Single multiplexed port for:
    - WebSocket control / RPC.
    - HTTP APIs (OpenAI-compatible, Responses, tools invoke).
    - Control UI and hooks.
- Default bind mode: `loopback`.

## Agent (Pi)

The Pi agent runs in RPC mode under the Gateway. Tool streaming and block streaming are first-class. The Gateway routes inbound messages to sessions and forwards tool calls to the appropriate runtime (browser, nodes, sessions, etc.).

## Sessions

- `main` for direct chats.
- Group isolation via group rules ([Group routing](../channels/groups.md)).
- Activation modes, queue modes, reply-back behavior.

See [Sessions & routing](sessions.md) for more.

## See also

- [Gateway](../gateway/index.md).
- [Sessions & routing](sessions.md).
- [Models & failover](models.md).
