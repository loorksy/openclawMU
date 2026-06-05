# Browser

OpenClaw ships an integrated browser tool that the Pi agent can drive directly. It uses a dedicated openclaw Chrome / Chromium instance controlled via the Chrome DevTools Protocol (CDP).

## Capabilities

- **Snapshots** — capture page state for the agent to reason about.
- **Actions** — click, type, navigate, scroll.
- **Uploads** — submit forms with attached files.
- **Profiles** — persistent Chrome profiles for logged-in browsing.

## Profiles

Browser profiles persist cookies and storage between runs. Useful for sites the agent needs to revisit while signed in. Profile management is exposed via the CLI and the Control UI.

## Browser login

The browser tool supports a guided login flow so the agent can pause for a human to complete authentication, then resume with the resulting session.

## Troubleshooting

The upstream `docs/tools/browser-linux-troubleshooting.md` covers Linux-specific issues (Chrome dependencies, sandboxing, display).

## See also

- [Skills](skills.md).
- [Slash commands](slash-commands.md).
- [Concepts → Architecture](../concepts/architecture.md).
