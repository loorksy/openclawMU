# Doctor

`openclaw doctor` is the repair + migration tool for OpenClaw. It fixes stale config and state, checks health, and provides actionable repair steps.

Treat doctor as a required post-install and post-upgrade step. It surfaces risky / misconfigured DM policies before they hit your channels.

## Quick start

```bash
openclaw doctor
```

## Modes

### Headless / automation

Accept defaults without prompting (including restart / service / sandbox repair steps when applicable):

```bash
openclaw doctor --yes
```

### Apply recommended repairs

```bash
openclaw doctor --repair
```

Repairs + restarts where safe, without prompting.

### Apply aggressive repairs

```bash
openclaw doctor --repair --force
```

Also overwrites custom supervisor configs.

### Non-interactive (safe only)

```bash
openclaw doctor --non-interactive
```

Runs without prompts and only applies safe migrations (config normalization + on-disk state moves). Skips restart / service / sandbox actions that require human confirmation. Legacy state migrations run automatically when detected.

### Deep checks

```bash
openclaw doctor --deep
```

Extends the check set beyond the default smoke test.

## What it checks

- Config schema validity.
- Stale state files and legacy paths (auto-migrates safely when possible).
- Channel DM policies (warns on risky / open policies).
- Service health (launchd / systemd user service, RPC probe, port binding).
- Sandbox readiness (multi-tenant).

## When to run it

- After every install or upgrade.
- After editing `openclaw.json` by hand.
- Before exposing the Gateway via Tailscale or SSH.
- When diagnosing a misbehaving channel or pairing flow.
