# Security Disclosure

If you believe you've found a security issue in OpenClaw, please report it privately.

## Reporting

Report vulnerabilities directly to the repository where the issue lives:

- **Core CLI and gateway** — [openclaw/openclaw](https://github.com/openclaw/openclaw).
- **macOS desktop app** — [openclaw/openclaw](https://github.com/openclaw/openclaw) (`apps/macos`).
- **iOS app** — [openclaw/openclaw](https://github.com/openclaw/openclaw) (`apps/ios`).
- **Android app** — [openclaw/openclaw](https://github.com/openclaw/openclaw) (`apps/android`).
- **ClawHub** — [openclaw/clawhub](https://github.com/openclaw/clawhub).
- **Trust and threat model** — [openclaw/trust](https://github.com/openclaw/trust).

For issues that don't fit a specific repo, or if you're unsure, email **security@openclaw.ai** and the team will route it.

For full reporting instructions see the [Trust page](https://trust.openclaw.ai).

## Required in reports

1. **Title**.
2. **Severity assessment**.
3. **Impact**.
4. **Affected component**.
5. **Technical reproduction**.
6. **Demonstrated impact**.
7. **Environment**.
8. **Remediation advice**.

Reports without reproduction steps, demonstrated impact, and remediation advice will be deprioritized. Given the volume of AI-generated scanner findings, the project must ensure vetted reports from researchers who understand the issues.

## Security & trust

**Jamieson O'Reilly** ([@theonejvo](https://twitter.com/theonejvo)) is Security & Trust at OpenClaw. Jamieson is the founder of [Dvuln](https://dvuln.com) and brings experience in offensive security, penetration testing, and security program development.

## Bug bounties

OpenClaw is a labor of love. There is no bug bounty program and no budget for paid reports. Please still disclose responsibly so the maintainers can fix issues quickly. The best way to help the project right now is by sending PRs.

## Out of scope

- Public internet exposure.
- Using OpenClaw in ways that the docs recommend not to.
- Prompt injection attacks.

## Operational guidance

For threat model + hardening guidance (including `openclaw security audit --deep` and `--fix`), see [Gateway security](../gateway/security.md) and the upstream `docs/gateway/security/` directory.

## Tool filesystem hardening

- `tools.exec.applyPatch.workspaceOnly: true` (recommended) — keeps `apply_patch` writes / deletes within the configured workspace directory.
