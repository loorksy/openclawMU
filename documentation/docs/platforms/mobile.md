# iOS & Android

OpenClaw ships iOS and Android apps that act as **nodes** — they pair to a Gateway and expose device-local capabilities to the agent.

## iOS

- **Canvas** with A2UI.
- **Voice Wake** for always-on listening.
- **Talk Mode** overlay for continuous conversation.
- **Camera** (snap and clip).
- **Screen recording**.
- **Bonjour pairing** for local-network discovery.

## Android

- **Canvas** with A2UI.
- **Talk Mode**.
- **Camera** (snap and clip).
- **Screen recording**.
- **Optional SMS** integration.

## Pairing

Pair a device through the Control UI or the CLI:

```bash
openclaw node pair list
openclaw node pair approve <code>
```

Tenant-scoped pairing is supported under [Multi-Tenancy](../multi-tenancy/index.md).

## See also

- [macOS](macos.md).
- [Nodes](nodes.md).
- [Remote access](../gateway/remote.md).
