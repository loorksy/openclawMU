# From Source

Use the source build when you're working on OpenClaw itself or want to track `main`.

Prefer `pnpm` for builds from source. Bun is optional for running TypeScript directly.

## Clone and build

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw

pnpm install
pnpm ui:build # auto-installs UI deps on first run
pnpm build

pnpm openclaw onboard --install-daemon
```

For the multi-tenant fork, clone `https://github.com/neul-labs/openclawMU.git` instead.

## Dev loop

```bash
# Auto-reload on TS changes
pnpm gateway:watch
```

`pnpm openclaw ...` runs TypeScript directly via `tsx`. `pnpm build` produces `dist/` for running via Node or the packaged `openclaw` binary.

## Workspace layout (high level)

- `apps/` — packaged applications.
- `packages/` — shared workspace packages.
- `extensions/` — channel extensions (Mattermost, Matrix, Zalo, etc.).
- `ui/` — Control UI / dashboard.
- `Swabble/` — macOS companion app.
- `scripts/` — install, packaging, and ops scripts.
- `skills/` — bundled skills.
- `src/` — Gateway and core TypeScript.
- `docs/` — upstream documentation source.
- `test/` — Vitest suites (unit, e2e, extensions, gateway, live).

## Linting and tests

The repo uses pre-commit hooks (`.pre-commit-config.yaml`), `oxlint`/`oxfmt`, markdownlint, swiftlint/swiftformat for the macOS code, and Vitest. See `CONTRIBUTING.md` at the repo root.
