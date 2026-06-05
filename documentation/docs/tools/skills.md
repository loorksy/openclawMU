# Skills

Skills extend the agent with bundled, managed, or workspace-installed capabilities. The skills platform handles install gating, UI, and discovery.

## Skill flavors

- **Bundled** — ship with OpenClaw and are always available.
- **Managed** — pulled from a registry (ClawHub) on demand.
- **Workspace** — installed by the user (or tenant) into their workspace.

## Multi-tenant skills

In OpenClawMU, skills are installed in the tenant's workspace at `{tenantDir}/workspace/`. The config overlay allows per-tenant skill settings, and binary requirements are tracked per skill.

Tenant-allowed skill methods:

- `skills.status` — check skill status.
- `skills.bins` — list required binaries.
- `skills.install` — install skills.
- `skills.update` — update skill settings.

See [Multi-Tenancy](../multi-tenancy/index.md).

## ClawHub (skill registry)

ClawHub is a minimal skill registry. With ClawHub enabled, the agent can search for skills automatically and pull in new ones as needed.

External: [clawhub.com](https://clawhub.com).

## Authoring skills

The upstream `docs/tools/creating-skills.md` documents the skill format and authoring workflow. The `skills/` directory in the repo contains the bundled skills as reference implementations.

## See also

- [Browser](browser.md).
- [Slash commands](slash-commands.md).
