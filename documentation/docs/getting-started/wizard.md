# Onboarding Wizard

The onboarding wizard is the recommended path for new installs. It walks through gateway setup, workspace creation, channel pairing, and skill selection in your terminal.

## Run it

```bash
openclaw onboard --install-daemon
```

`--install-daemon` registers the Gateway as a user service (launchd on macOS, systemd on Linux) so it starts on login.

## What the wizard does

- Creates `~/.openclaw/` and the default workspace.
- Configures Gateway bind, port, and auth.
- Walks through channel pairing (WhatsApp, Telegram, Discord, etc.).
- Picks an initial model/auth profile (OAuth or API key).
- Installs the Gateway daemon (when `--install-daemon` is passed).
- Selects starter skills.

## Daemon vs foreground

The wizard installs a user service so the Gateway stays up across reboots. You can still run a foreground Gateway alongside for development:

```bash
openclaw gateway --port 18789 --verbose
```

## Re-running the wizard

The wizard is idempotent — re-running it picks up existing state and only prompts for changes. Use it after major upgrades or when adding a new channel.

## Skipping the wizard

If you prefer manual config, edit `~/.openclaw/openclaw.json` directly. See [Gateway configuration](../gateway/configuration.md) for the schema.
