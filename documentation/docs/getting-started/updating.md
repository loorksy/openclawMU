# Updating

## Development channels

- **stable** — tagged releases (`vYYYY.M.D` or `vYYYY.M.D-<patch>`), npm dist-tag `latest`.
- **beta** — prerelease tags (`vYYYY.M.D-beta.N`), npm dist-tag `beta` (macOS app may be missing).
- **dev** — moving head of `main`, npm dist-tag `dev` (when published).

## Switching channels

```bash
openclaw update --channel stable|beta|dev
```

Switching updates both the git branch (when using a source install) and the npm dist-tag.

See [Development channels](../reference/development-channels.md) for the full policy.

## After updating

Always run:

```bash
openclaw doctor
```

`openclaw doctor` validates the configuration, runs migrations, and surfaces risky/misconfigured DM policies. Treat doctor as a required post-deploy step — it catches issues before they hit your channels.

## Daemon refresh

If you installed with `--install-daemon`, the user service picks up the new binary automatically on the next restart. To force-restart immediately:

- **macOS** — `launchctl kickstart -k gui/$(id -u)/com.openclaw.gateway`
- **Linux** — `systemctl --user restart openclaw-gateway`
