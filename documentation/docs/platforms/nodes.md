# Nodes

A node is any process that advertises device-local capabilities to the Gateway and exposes them via `node.invoke`. The macOS app in node mode, the iOS app, and the Android app all act as nodes.

## Node protocol (WebSocket)

| Method                | Purpose                                |
| --------------------- | -------------------------------------- |
| `node.pair.request`   | Initiate pairing from the node side.   |
| `node.pair.list`      | List pending pairings.                 |
| `node.pair.approve`   | Approve a pending pairing.             |
| `node.pair.reject`    | Reject a pending pairing.              |
| `node.pair.verify`    | Verify a pairing token.                |
| `node.rename`         | Rename a paired node.                  |
| `node.list`           | List paired nodes.                     |
| `node.describe`       | Get a node's capabilities + TCC map.   |
| `node.invoke`         | Invoke a node action.                  |

In multi-tenant mode, all of these are scoped to the calling tenant. See [Multi-Tenancy](../multi-tenancy/index.md).

## Common node actions

- `camera.snap` / `camera.clip` — capture from the device camera.
- `screen.record` — record the device screen.
- `location.get` — return the device's current location.
- `canvas.*` — A2UI push / reset / eval / snapshot.
- `system.run` (macOS) — runs a local command.
- `system.notify` (macOS) — posts a user notification.

## Bonjour discovery

iOS and macOS nodes can discover the Gateway on the local network via Bonjour. Useful for zero-config pairing on the same Wi-Fi.

## See also

- [macOS](macos.md).
- [iOS & Android](mobile.md).
- [Gateway security](../gateway/security.md).
