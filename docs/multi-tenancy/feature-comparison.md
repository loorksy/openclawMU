# Multi-Tenancy vs Default OpenClaw - Feature Comparison

This document explicitly maps the differences between default (single-operator) OpenClaw and multi-tenant OpenClaw, documenting all limitations for tenant tokens.

## Authentication Modes

| Mode                          | Token Type                             | Capabilities                                |
| ----------------------------- | -------------------------------------- | ------------------------------------------- |
| **Default (Single Operator)** | Gateway token or password              | Full system access                          |
| **Multi-Tenant (Admin)**      | Gateway token + `operator.admin` scope | Full system access + tenant management      |
| **Multi-Tenant (Tenant)**     | `tenant:{tenantId}:{secret}` format    | Restricted to own sandbox + self-management |

## Feature Availability Matrix

### Legend

- **Full** - Complete access
- **Self** - Own resources only
- **None** - Not available

| Feature Category     | Default Mode | Multi-Tenant Admin | Multi-Tenant Tenant     |
| -------------------- | ------------ | ------------------ | ----------------------- |
| **Configuration**    | Full         | Full               | Self (overlay)          |
| **Agent Management** | Full         | Full               | Read-only               |
| **Session Control**  | Full         | Full               | Self (read-only)        |
| **Terminal Access**  | Full         | Full               | Self                    |
| **Canvas/UI**        | Full         | Full               | Self\*                  |
| **Cron Jobs**        | Full         | Full               | Self (no auto-schedule) |
| **Skills**           | Full         | Full               | Self                    |
| **Channels**         | Full         | Full               | Read-only               |
| **Pairing**          | Full         | Full               | Self                    |
| **Backups**          | N/A          | Full               | Self                    |
| **Usage/Quotas**     | N/A          | Full               | Self                    |

\*Canvas access is enabled but resource isolation is not yet implemented - tenants may see global canvas data.

## Detailed Feature Breakdown

### 1. Terminal Access

| Operation         | Default | Admin     | Tenant             |
| ----------------- | ------- | --------- | ------------------ |
| `terminal.spawn`  | Yes     | Yes       | Yes (own sandbox)  |
| `terminal.write`  | Yes     | Yes       | Yes (own sessions) |
| `terminal.resize` | Yes     | Yes       | Yes (own sessions) |
| `terminal.close`  | Yes     | Yes       | Yes (own sessions) |
| `terminal.list`   | Yes     | Yes (all) | Yes (own only)     |

**Tenant Limitation:** Tenants can only spawn terminals in their own sandbox (`~/.openclaw/tenants/{tenantId}/workspace`).

### 2. Configuration Management

| Operation       | Default | Admin | Tenant              |
| --------------- | ------- | ----- | ------------------- |
| `config.get`    | Yes     | Yes   | Yes (merged config) |
| `config.set`    | Yes     | Yes   | Yes (overlay only)  |
| `config.patch`  | Yes     | Yes   | Yes (overlay only)  |
| `config.apply`  | Yes     | Yes   | **No**              |
| `config.schema` | Yes     | Yes   | Yes                 |

**Tenant Capabilities:**

- `config.get` returns the merged config (base + tenant overlay)
- `config.set/patch` write to the tenant's overlay at `{tenantDir}/openclaw.json`
- Admin-only keys (gateway, providers, meta) are filtered from tenant writes
- Tenants cannot trigger gateway restarts via config changes

### 3. Agent Management

| Operation          | Default | Admin | Tenant                   |
| ------------------ | ------- | ----- | ------------------------ |
| `agents.list`      | Yes     | Yes   | Yes (from merged config) |
| `agents.create`    | Yes     | Yes   | **No**                   |
| `agents.update`    | Yes     | Yes   | **No**                   |
| `agents.delete`    | Yes     | Yes   | **No**                   |
| `agent` (chat)     | Yes     | Yes   | **No**                   |
| `agent.identity.*` | Yes     | Yes   | **No**                   |

**Tenant Capabilities:**

- `agents.list` returns agents defined in the tenant's merged config (base + overlay)
- Agents must be pre-configured by admin in the tenant's config overlay
- Tenants can interact with agents via the terminal interface

### 4. Session Management

| Operation          | Default | Admin | Tenant             |
| ------------------ | ------- | ----- | ------------------ |
| `sessions.list`    | Yes     | Yes   | Yes (own sessions) |
| `sessions.preview` | Yes     | Yes   | Yes (own sessions) |
| `sessions.patch`   | Yes     | Yes   | **No**             |
| `sessions.reset`   | Yes     | Yes   | **No**             |
| `sessions.delete`  | Yes     | Yes   | **No**             |
| `sessions.compact` | Yes     | Yes   | **No**             |

**Tenant Capabilities:**

- `sessions.list` returns only sessions prefixed with `tenant:{tenantId}:`
- `sessions.preview` only allows previewing own tenant's sessions
- Session keys are automatically namespaced with tenant prefix at API entry points

### 5. Cron Jobs

| Operation     | Default | Admin | Tenant |
| ------------- | ------- | ----- | ------ |
| `cron.list`   | Yes     | Yes   | **No** |
| `cron.add`    | Yes     | Yes   | **No** |
| `cron.update` | Yes     | Yes   | **No** |
| `cron.remove` | Yes     | Yes   | **No** |
| `cron.run`    | Yes     | Yes   | **No** |
| `cron.status` | Yes     | Yes   | **No** |

**Tenant Limitation:** Tenants cannot create or manage scheduled tasks.

### 6. Skills & Plugins

| Operation        | Default | Admin | Tenant |
| ---------------- | ------- | ----- | ------ |
| `skills.status`  | Yes     | Yes   | **No** |
| `skills.install` | Yes     | Yes   | **No** |
| `skills.update`  | Yes     | Yes   | **No** |

**Tenant Limitation:** Tenants cannot install or manage skills. Skills must be pre-configured by admin.

### 7. Channel Operations

| Operation         | Default | Admin | Tenant |
| ----------------- | ------- | ----- | ------ |
| `channels.status` | Yes     | Yes   | **No** |
| `channels.logout` | Yes     | Yes   | **No** |
| `send` (message)  | Yes     | Yes   | **No** |
| `chat.send`       | Yes     | Yes   | **No** |

**Tenant Limitation:** Tenants cannot interact with messaging channels (WhatsApp, Telegram, Discord, etc.).

### 8. Device Pairing

| Operation        | Default | Admin | Tenant |
| ---------------- | ------- | ----- | ------ |
| `node.pair.*`    | Yes     | Yes   | **No** |
| `device.pair.*`  | Yes     | Yes   | **No** |
| `device.token.*` | Yes     | Yes   | **No** |
| `node.invoke`    | Yes     | Yes   | **No** |
| `node.list`      | Yes     | Yes   | **No** |

**Tenant Limitation:** Tenants cannot pair nodes, devices, or invoke commands on remote nodes.

### 9. Canvas/UI Access

| Resource          | Default | Admin | Tenant      |
| ----------------- | ------- | ----- | ----------- |
| `/a2ui/*`         | Yes     | Yes   | **No**      |
| `/canvas-host/*`  | Yes     | Yes   | **No**      |
| `/canvas/ws`      | Yes     | Yes   | **No**      |
| Bearer token auth | Yes     | Yes   | **Blocked** |

**Tenant Limitation:** Tenants are explicitly blocked from canvas access at the HTTP layer. The `hasAuthorizedWsClientForIp()` function filters out tenant-scoped connections.

### 10. Tenant Self-Management

| Operation                | Default | Admin     | Tenant                   |
| ------------------------ | ------- | --------- | ------------------------ |
| `tenants.list`           | N/A     | Yes       | **No**                   |
| `tenants.create`         | N/A     | Yes       | **No**                   |
| `tenants.get`            | N/A     | Yes (all) | Yes (self)               |
| `tenants.delete`         | N/A     | Yes       | Yes (self, with confirm) |
| `tenants.update`         | N/A     | Yes       | **No**                   |
| `tenants.rotate`         | N/A     | Yes (all) | Yes (self)               |
| `tenants.backup`         | N/A     | Yes (all) | Yes (self)               |
| `tenants.backups.list`   | N/A     | Yes (all) | Yes (self)               |
| `tenants.backups.delete` | N/A     | Yes       | **No**                   |
| `tenants.restore`        | N/A     | Yes       | Yes (self only)          |
| `tenants.usage`          | N/A     | Yes (all) | Yes (self)               |
| `tenants.quota.status`   | N/A     | Yes (all) | Yes (self)               |
| `tenants.usage.history`  | N/A     | Yes (all) | Yes (self)               |

**Tenant Capabilities:**

- `tenants.delete` allows self-deletion with `confirm: true` (always deletes data)
- `tenants.restore` allows restoring own backups (cannot use `createIfMissing`)
- Cannot enumerate other tenants or delete backups

### 11. System Operations

| Operation      | Default | Admin | Tenant |
| -------------- | ------- | ----- | ------ |
| `health`       | Yes     | Yes   | Yes    |
| `status`       | Yes     | Yes   | **No** |
| `logs.tail`    | Yes     | Yes   | **No** |
| `models.list`  | Yes     | Yes   | **No** |
| `usage.status` | Yes     | Yes   | **No** |
| `update.run`   | Yes     | Yes   | **No** |
| `wizard.*`     | Yes     | Yes   | **No** |

**Tenant Limitation:** Tenants can only call `health`. All other system operations are blocked.

## Data Isolation

### Default Mode Storage

```
~/.openclaw/
├── openclaw.json5       # Main configuration
├── sessions/            # Session transcripts
├── agents/              # Agent workspaces
├── cron/                # Cron jobs
├── media/               # Media cache
└── logs/                # Log files
```

### Multi-Tenant Storage

```
~/.openclaw/
├── tenants.json         # Tenant registry (admin only)
├── metrics/             # System-wide metrics (admin only)
└── tenants/
    └── {tenantId}/
        ├── workspace/   # Mounted at /workspace in sandbox
        ├── agents/      # Per-tenant agent sessions
        │   └── {agentId}/sessions/
        ├── memory/      # Per-tenant SQLite databases
        │   └── {agentId}.sqlite
        ├── plugins/     # Per-tenant plugins
        ├── sandboxes/   # Per-tenant sandbox state
        ├── credentials/ # Per-tenant credentials
        ├── usage/       # Per-tenant usage tracking
        │   ├── current.json
        │   └── {YYYY-MM}.json
        └── openclaw.json # Tenant config overlay (not API-exposed)
```

### Isolation Guarantees

- File system paths are validated with tenant ID regex (`^[a-z0-9][a-z0-9_-]{0,31}$`)
- Session keys are auto-prefixed with `tenant:{tenantId}:` at HTTP entry points
- SQLite databases are per-tenant-per-agent
- Sandbox processes run in user namespaces with tenant-specific workspaces

## Quota System (Tenant Only)

| Quota                       | Type     | Description                  |
| --------------------------- | -------- | ---------------------------- |
| `monthlyTokenLimit`         | Hard     | Block requests when exceeded |
| `monthlyTokenSoftLimit`     | Soft     | Warning threshold            |
| `monthlyCostLimitCents`     | Hard     | Block on cost exceeded       |
| `monthlyCostSoftLimitCents` | Soft     | Warning threshold            |
| `diskSpaceLimitBytes`       | Hard     | Limit workspace size         |
| `maxConcurrentSessions`     | Hard     | Limit active sessions        |
| `requestsPerMinute`         | Rate     | API rate limiting            |
| `requestsPerHour`           | Rate     | API rate limiting            |
| `maxSandboxCpuPercent`      | Resource | CPU limit (100 = 1 core)     |
| `maxSandboxMemoryMB`        | Resource | Memory limit                 |
| `maxSandboxDiskMB`          | Resource | Sandbox disk limit           |
| `maxSandboxPids`            | Resource | Max processes                |

**Note:** Quotas only apply to tenants. Default mode has no built-in quotas.

## Scope Comparison

### Default Mode Scopes

| Scope                | Purpose                     |
| -------------------- | --------------------------- |
| `operator.admin`     | Full system access          |
| `operator.read`      | Read-only operations        |
| `operator.write`     | Read + write operations     |
| `operator.approvals` | Execution approval handling |
| `operator.pairing`   | Device/node pairing         |

### Tenant Token Scopes

Tenant tokens do **not** use the scope system. Authorization is based solely on:

1. Is it a tenant token? (`client.tenantId` is set)
2. Is the method in `TENANT_ALLOWED_METHODS`?
3. Does the tenant own the resource? (`canAccessTenant()`)

## Summary: What Tenants CAN Do

1. **Terminal Access** - Spawn and interact with terminals in their sandbox
2. **Configuration** - Read merged config, write to their overlay
3. **Agent List** - View agents from their merged config
4. **Session Access** - List and preview their own sessions
5. **View Usage** - Check token usage, costs, quota status
6. **Backup Data** - Export tenant data to S3-compatible storage
7. **List Backups** - Enumerate their own backups
8. **Restore Backups** - Restore their own backups
9. **Rotate Token** - Generate a new authentication token
10. **Get Info** - Retrieve their tenant metadata
11. **Self-Delete** - Delete their own tenant (with confirmation)
12. **Health Check** - Call the health endpoint

## Summary: What Tenants CANNOT Do

1. **No Agent Create/Update/Delete** - Cannot create or modify agents
2. **No Session Patch/Reset/Delete** - Cannot modify or delete sessions
3. **No Cron Jobs** - Cannot schedule tasks
4. **No Skills** - Cannot install or update skills
5. **No Channels** - Cannot send messages or manage channel connections
6. **No Pairing** - Cannot pair devices or nodes
7. **No Canvas** - Blocked from UI builder access
8. **No Other Tenants** - Cannot enumerate or access other tenants
9. **No Backup Deletion** - Cannot delete backups
10. **No System Status** - Limited to health check only
11. **No Admin Config** - Cannot modify gateway, providers, or meta config

## Implementation Reference

| Component            | File Path                                |
| -------------------- | ---------------------------------------- |
| Method authorization | `src/gateway/method-auth.ts`             |
| Tenant methods       | `src/gateway/server-methods/tenants.ts`  |
| Canvas blocking      | `src/gateway/server-http.ts:84-95`       |
| Session key scoping  | `src/gateway/http-utils.ts:86-111`       |
| Path resolution      | `src/tenants/paths.ts`                   |
| Token validation     | `src/tenants/registry.ts`                |
| Quota types          | `src/tenants/types.ts`                   |
| Terminal isolation   | `src/gateway/server-methods/terminal.ts` |
