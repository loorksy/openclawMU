# Multi-Tenancy

OpenClawMU extends OpenClaw with enterprise-grade multi-tenancy, allowing multiple isolated users (tenants) to share a single gateway instance while maintaining complete data isolation.

## Features

### Core Multi-Tenancy

- **Tenant Isolation** — Complete data isolation per tenant (sessions, memory, plugins, sandboxes).
- **Per-Tenant Authentication** — Secure tokens with SHA-256 hashing and timing-safe comparison.
- **Configuration Overlays** — Per-tenant config with admin-only key protection.
- **Usage Tracking** — Token usage, cost tracking, and historical snapshots.

### Sandbox & Terminal

- **Bubblewrap Sandbox** — Lightweight Linux namespace isolation (no root required).
- **Docker Support** — Full container isolation with cgroups and seccomp.
- **Web Terminal** — Browser-based xterm.js terminal to tenant sandboxes.

### Integration Features

- **Cron Jobs** — Tenant-isolated scheduled jobs (separate store, manual triggers).
- **Skills Management** — Per-tenant skill installation in workspace.
- **Device Pairing** — Tenant-isolated device pairing and token management.
- **Node Pairing** — Tenant-scoped node pairing and commands.
- **Session Scoping** — All session keys prefixed with tenant ID.

### HTTP API Integration

- **OpenAI Compatibility** — `/v1/chat/completions` scoped to tenant sessions.
- **OpenResponses** — `/v1/responses` scoped to tenant sessions.
- **Internal API** — Control plane endpoints for tenant management.

### Backup & Restore

- **S3 Backend** — AWS S3, MinIO, GCS, and other S3-compatible storage.
- **Security** — Path traversal protection in tar extraction.
- **Metadata Tracking** — Backup history per tenant.

## Quick start

### Create a tenant

```bash
openclaw tenants create demo
```

This outputs a tenant token in the format `tenant:demo:xxxxx`.

### Connect as a tenant

```bash
# Using environment variable
OPENCLAW_GATEWAY_TOKEN="tenant:demo:xxxxx" openclaw chat

# Using CLI argument
openclaw --remote-token "tenant:demo:xxxxx" chat
```

### List tenants

```bash
openclaw tenants list
```

### Rotate tenant token

```bash
openclaw tenants token demo
```

### Remove a tenant

```bash
openclaw tenants remove demo --force --delete-data
```

See [Tenant Operations](tenant-operations.md) for the full CLI surface (backups, restore, info).

## Configuration

Multi-tenancy is enabled automatically when tenant tokens are used. No additional configuration is required.

### Optional settings

```json5
{
  gateway: {
    multiTenant: true, // Enable multi-tenancy (default: auto)
    controlPlaneToken: "secret-token", // For internal HTTP API
  },
}
```

## Data isolation

Each tenant's data is stored in a separate directory:

```
~/.openclaw/
├── tenants.json                    # Tenant registry
├── tenants/
│   └── {tenantId}/
│       ├── openclaw.json           # Tenant config overlay
│       ├── workspace/              # Working directory (mounts at /workspace in sandbox)
│       ├── agents/
│       │   └── {agentId}/
│       │       └── sessions/       # Session transcripts
│       ├── memory/                 # Embedding database
│       │   └── {agentId}.sqlite    # Per-agent memory DB
│       ├── plugins/                # Installed skills
│       ├── sandboxes/              # Sandbox state
│       ├── credentials/            # Auth tokens
│       ├── cron/
│       │   └── jobs.json           # Tenant cron jobs
│       ├── usage/
│       │   ├── current.json        # Current period usage
│       │   ├── {yyyy-mm}.json      # Historical usage
│       │   └── rate-limits.json    # Rate limit state
│       └── backups.json            # Backup metadata
```

### Session key scoping

All tenant session keys are prefixed with `tenant:{tenantId}:` to ensure isolation:

- Format: `tenant:{tenantId}:agent:{agentId}:{rest}`
- Prevents cross-tenant session access.
- Enforced in both WebSocket and HTTP handlers.

## Tenant ID format

- Pattern: `^[a-z0-9][a-z0-9_-]{0,31}$`
- Length: 1-32 characters.
- Characters: lowercase alphanumeric, hyphens, underscores.
- Examples: `demo`, `user-123`, `prod_tenant`.

## Security

### Authentication

- **Token format** — `tenant:{tenantId}:{secret}` (32 bytes base64url encoded).
- **Storage** — SHA-256 hashing before storage.
- **Comparison** — Timing-safe comparison (`crypto.timingSafeEqual()`).
- **Rotation** — Support for token rotation with single-use plaintext return.
- **Disabled flag** — Ability to disable tenant without deleting data.

### Authorization

- Role-based: `operator` scope with explicit method matching.
- Tenant tokens: only allowed methods from `TENANT_ALLOWED_METHODS`.
- Method authorization via `authorizeGatewayMethod()`.

### Sandbox security

- Read-only root filesystem.
- User namespace isolation (non-root capable).
- Network namespace isolation option.
- Resource limits via systemd-run (CPU, memory, processes).
- Symlink/path-traversal protection in tar extraction.

### Config overlay security

- Admin-only keys prevent privilege escalation: `gateway`, `models`, `meta`.
- Nested key filtering for sensitive values: `agents.credentialsPath`, `env.shellEnv`.
- Deep merge prevents full config overwrite.

## Sandbox backends

### Bubblewrap (bwrap)

Bubblewrap provides lightweight Linux user-namespace isolation without requiring root or a container runtime.

```bash
# Debian/Ubuntu
apt install bubblewrap

# Fedora
dnf install bubblewrap

# Arch
pacman -S bubblewrap
```

Features: user namespaces (no root required), network isolation, read-only root filesystem, process and IPC isolation.

### Docker

Docker provides full container isolation with cgroups, seccomp, and AppArmor support.

Features: image management, cgroup resource limits, seccomp profiles, AppArmor profiles.

## Web terminal

Tenants can access their sandbox environment through a web-based terminal using xterm.js. The terminal connects via WebSocket to the gateway, which spawns an interactive shell inside the tenant's bwrap sandbox.

### Terminal gateway methods

| Method            | Description                   | Access                          |
| ----------------- | ----------------------------- | ------------------------------- |
| `terminal.spawn`  | Spawn a new terminal session  | Tenant auth required            |
| `terminal.write`  | Write data to a terminal      | Owner tenant or admin           |
| `terminal.resize` | Resize terminal (cols/rows)   | Owner tenant or admin           |
| `terminal.close`  | Close a terminal session      | Owner tenant or admin           |
| `terminal.list`   | List active terminal sessions | Tenant sees own, admin sees all |

Events: `terminal.output`, `terminal.exit`.

### Usage example

```typescript
// Using the xterm-terminal web component
import { XtermTerminal } from "@openclaw/ui/terminal";

const terminal = document.createElement("xterm-terminal");
terminal.gatewayUrl = "wss://gateway.example.com";
terminal.token = "tenant:demo:xxxxx";
terminal.autoConnect = true;
document.body.appendChild(terminal);
```

## Cron jobs

Tenants have isolated cron job storage and management with full scheduling support.

- Tenant jobs stored in `{tenantDir}/cron/jobs.json`.
- Tenant-isolated cron service with auto-scheduling.
- Standard cron expression format.
- Manual triggers via `cron.run`.

Methods: `cron.list`, `cron.add`, `cron.update`, `cron.remove`, `cron.status`, `cron.runs`, `cron.run`.

## Skills & plugins

Tenants can install and manage skills within their workspace.

- Skills installed in `{tenantDir}/workspace/`.
- Config overlay allows per-tenant skill settings.
- Bins requirements tracked per skill.

Methods: `skills.status`, `skills.bins`, `skills.install`, `skills.update`.

## Usage tracking & quotas

### Tracked metrics (per month)

- **Tokens** — total, input, output, cache read/write.
- **Cost** — monthly cost in cents.
- **Disk** — workspace, agent data, memory DB.
- **Sessions** — total, active, messages.
- **API** — requests per minute/hour.
- **Sandbox** — CPU seconds, peak memory.

### Quota limits (configurable)

- Monthly token limits (soft/hard).
- Monthly cost limits (soft/hard).
- Disk space limits.
- Concurrent session limits.
- Rate limits (requests/minute, requests/hour).
- Sandbox resource limits (CPU %, memory, PIDs).

Methods: `tenants.usage`, `tenants.quota.status`, `tenants.usage.history`.

## Backup and restore

Tenant data can be backed up to S3-compatible storage (AWS S3, MinIO, GCS, etc.).

| Method                   | Description            | Access                |
| ------------------------ | ---------------------- | --------------------- |
| `tenants.backup`         | Backup tenant to S3    | Owner tenant or admin |
| `tenants.restore`        | Restore tenant from S3 | Admin only            |
| `tenants.backups.list`   | List tenant backups    | Owner tenant or admin |
| `tenants.backups.delete` | Delete a backup        | Admin only            |

All backup methods accept S3 configuration:

```typescript
{
  bucket: "my-backups",            // Required
  endpoint: "https://minio.local", // For S3-compatible
  region: "us-east-1",
  prefix: "openclaw-backups"
}
```

S3 credentials are resolved server-side (for example via IAM role, IRSA, or server environment).

```bash
# Backup a tenant
openclaw tenants backup demo --bucket my-backups

# List backups
openclaw tenants backups demo --bucket my-backups

# Restore a tenant
openclaw tenants restore demo --bucket my-backups --key backups/demo/2026-02-08.tar.gz
```

Security: path traversal protection in tar extraction, symlink validation before extraction, secure tar creation with explicit paths.

## HTTP API scoping

Tenant tokens work with the OpenAI-compatible and OpenResponses HTTP endpoints. When authenticated with a tenant token:

1. Session keys are automatically prefixed with `tenant:{tenantId}:`.
2. Explicit session keys with wrong tenant prefix are rejected (403).
3. All agent operations run in tenant sandbox context.

### Endpoints

- `POST /v1/chat/completions` — OpenAI-compatible chat (tenant-scoped).
- `POST /v1/responses` — OpenResponses API (tenant-scoped).

### Example

```bash
curl -X POST https://gateway.example.com/v1/chat/completions \
  -H "Authorization: Bearer tenant:demo:xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openclaw:main",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Internal HTTP API

Control plane endpoints for programmatic tenant management.

### Authentication

Set `gateway.controlPlaneToken` in config and pass via `X-Control-Plane-Token` header.

### Endpoints

| Method | Path                                      | Description             |
| ------ | ----------------------------------------- | ----------------------- |
| GET    | `/internal/v1/status`                     | Server status & metrics |
| GET    | `/internal/v1/tenants/{id}`               | Get tenant info         |
| POST   | `/internal/v1/tenants/{id}`               | Create tenant           |
| DELETE | `/internal/v1/tenants/{id}`               | Delete tenant           |
| POST   | `/internal/v1/tenants/{id}/backup`        | Backup to S3            |
| POST   | `/internal/v1/tenants/{id}/restore`       | Restore from S3         |
| GET    | `/internal/v1/tenants/{id}/backups`       | List backups            |
| DELETE | `/internal/v1/tenants/{id}/backups/{key}` | Delete backup           |

### Status response

```json
{
  "version": "2026.2.15",
  "status": "healthy",
  "multiTenant": true,
  "metrics": {
    "cpuCount": 8,
    "loadAvg": [1.2, 1.5, 1.3],
    "memoryUsedMB": 512,
    "memoryTotalMB": 16384,
    "uptimeSeconds": 86400
  },
  "tenantsCount": 5
}
```

## Notes & limitations

### Current limitations

- **Wizard** — Configuration wizard is admin-only.
- **Global status** — Tenants cannot view global server status or logs (only health check).

### Design decisions

- **Single workspace** — All tenant agents share one workspace at `{tenantDir}/workspace`.
- **Config overlay** — Admin-only keys (`gateway`, `models`, `meta`) cannot be modified by tenants.

## See also

- [Feature comparison](feature-comparison.md) — single-operator vs multi-tenant.
- [Tenant operations](tenant-operations.md) — CLI reference.
- [Gateway security](../gateway/security.md).
- Admin Platform (Host-gated console): [docs/admin](https://docs.openclaw.ai/admin).
