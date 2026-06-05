# macOS

The macOS app is a menu bar control plane and node for OpenClaw. It bundles:

- **Voice Wake** / push-to-talk.
- **Talk Mode** overlay for continuous conversation.
- **WebChat**.
- **Debug tools**.
- **Remote gateway control**.
- **Canvas host** with A2UI.

## Install

- Download the latest release from the macOS app installer (links from the repo `README.md`).
- Or build from source via the `Swabble/` directory.

The app pairs to a local or remote Gateway. When the Gateway lives on a server, the macOS app acts as a node so device-local actions (camera, screen, notifications) still work locally.

## Permissions

The app advertises its capabilities + TCC permission map over the Gateway WebSocket (`node.list` / `node.describe`). Clients call into local actions via `node.invoke`:

- `system.run` — runs a local command and returns stdout / stderr / exit. Set `needsScreenRecording: true` to require screen-recording permission (otherwise: `PERMISSION_MISSING`).
- `system.notify` — posts a user notification and fails if notifications are denied.
- `canvas.*`, `camera.*`, `screen.record`, and `location.get` are routed via `node.invoke` and follow TCC permission status.

Elevated bash (host permissions) is separate from macOS TCC. Toggle with `/elevated on|off` (when allowlisted).

## See also

- [iOS & Android](mobile.md).
- [Nodes](nodes.md).
- [Gateway security](../gateway/security.md).
