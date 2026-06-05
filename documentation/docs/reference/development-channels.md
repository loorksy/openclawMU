# Development Channels

OpenClaw is published on three channels.

## Channels

- **stable** — tagged releases (`vYYYY.M.D` or `vYYYY.M.D-<patch>`), npm dist-tag `latest`.
- **beta** — prerelease tags (`vYYYY.M.D-beta.N`), npm dist-tag `beta` (macOS app may be missing).
- **dev** — moving head of `main`, npm dist-tag `dev` (when published).

## Switching channels

```bash
openclaw update --channel stable|beta|dev
```

This updates both the git branch (when using a source install) and the npm dist-tag.

## After switching

Always run:

```bash
openclaw doctor
```

Doctor migrates config + state and surfaces risky / misconfigured DM policies.

## See also

- [Updating](../getting-started/updating.md).
- [Doctor](../gateway/doctor.md).
