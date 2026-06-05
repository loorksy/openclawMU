# Remote Access

It's perfectly fine to run the Gateway on a small Linux instance. Clients (macOS app, CLI, WebChat) can connect over **Tailscale Serve / Funnel** or **SSH tunnels**, and you can still pair device nodes (macOS / iOS / Android) to execute device-local actions when needed.

## Split of responsibilities

- **Gateway host** runs the exec tool and channel connections by default.
- **Device nodes** run device-local actions (`system.run`, camera, screen recording, notifications) via `node.invoke`.

In short: exec runs where the Gateway lives; device actions run where the device lives.

## Patterns

### Tailscale Serve / Funnel

Set `gateway.tailscale.mode` to `serve` or `funnel`. The Gateway stays bound to `loopback`. See [Tailscale](tailscale.md) for the full guide.

### SSH tunnel

Forward the Gateway port to a remote host:

```bash
ssh -L 18789:127.0.0.1:18789 user@gateway-host
```

Clients then connect to `ws://127.0.0.1:18789/` locally and authenticate with the configured token / password.

### Remote Gateway + local nodes

- Run the Gateway on a Linux server (Hetzner / Fly / Render / etc.).
- Pair the macOS app and / or iOS / Android apps as nodes.
- Channel connections live on the server; camera / screen / system actions live on the paired devices.

## See also

- [Tailscale](tailscale.md).
- [Security](security.md) — auth modes and DM policy when exposing the Gateway.
- [Nodes & Platforms](../platforms/index.md).
