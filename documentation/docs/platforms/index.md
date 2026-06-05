# Nodes & Platforms

OpenClaw ships companion apps and node runtimes for macOS, iOS, and Android. The Gateway is the control plane; nodes execute device-local actions.

## Companion apps

- **macOS app** — menu bar control plane, Voice Wake / PTT, Talk Mode overlay, WebChat, debug tools, remote gateway control.
- **iOS node** — Canvas, Voice Wake, Talk Mode, camera, screen recording, Bonjour pairing.
- **Android node** — Canvas, Talk Mode, camera, screen recording, optional SMS.
- **macOS node mode** — exposes `system.run` / `system.notify` plus canvas / camera.

See [macOS](macos.md) and [iOS & Android](mobile.md) for details, and [Nodes](nodes.md) for the node protocol.

## Why nodes?

Run the Gateway anywhere (including a small Linux VPS) while keeping device-local actions on the devices that have them. Pair the macOS app and / or iOS / Android apps as nodes, and the agent can call into them via `node.invoke`.

- **Gateway host** runs the exec tool and channel connections.
- **Device nodes** run device-local actions (`system.run`, camera, screen recording, notifications).

In short: exec runs where the Gateway lives; device actions run where the device lives.

## Other platform targets

The repo includes platform notes for Windows (via WSL2), Linux, Raspberry Pi, Oracle Cloud, DigitalOcean, and more under `docs/platforms/`. WSL2 is strongly recommended for Windows installs.

## See also

- [macOS](macos.md).
- [iOS & Android](mobile.md).
- [Nodes](nodes.md).
- [Remote access](../gateway/remote.md).
