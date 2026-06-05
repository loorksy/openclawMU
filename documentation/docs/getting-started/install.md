# Install

Runtime: **Node 22 or later**.

## Recommended: npm + onboarding wizard

```bash
npm install -g openclaw@latest
# or: pnpm add -g openclaw@latest

openclaw onboard --install-daemon
```

`--install-daemon` installs the Gateway as a user service (launchd on macOS, systemd on Linux) so it stays running across reboots.

## Other install paths

OpenClaw ships installers and platform recipes for the most common targets. See the upstream guides for full details:

- **Docker** — `install/docker.md` in the repo.
- **Nix** — declarative config with the `nix-openclaw` flake.
- **Ansible** — `install/ansible.md`.
- **Podman** — `install/podman.md` plus `setup-podman.sh` at the repo root.
- **Cloud one-clicks** — Fly, Render, Railway, Northflank, Hetzner, GCP, DigitalOcean.
- **Bun runtime** — `install/bun.md` (optional; pnpm preferred for builds from source).

## Verifying the install

```bash
openclaw --version
openclaw doctor
```

`openclaw doctor` is the canonical validation command: it surfaces risky/misconfigured DM policies and other runtime issues.

## Next

- [Quick start](quickstart.md) — minimal commands to send your first message.
- [Onboarding wizard](wizard.md) — the recommended guided setup.
- [Updating](updating.md) — staying current and switching channels.
