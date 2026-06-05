# Feature Comparison

This page maps the differences between default (single-operator) OpenClaw and multi-tenant OpenClawMU, documenting all limitations for tenant tokens.

## Authentication modes

| Mode                          | Token type                             | Capabilities                                |
| ----------------------------- | -------------------------------------- | ------------------------------------------- |
| **Default (single operator)** | Gateway token or password              | Full system access                          |
| **Multi-tenant (admin)**      | Gateway token + `operator.admin` scope | Full system access + tenant management      |
| **Multi-tenant (tenant)**     | `tenant:{tenantId}:{secret}` format    | Restricted to own sandbox + self-management |

## Feature availability matrix

Legend: **Full** = complete access, **Self** = own resources only, **None** = not available.

| Feature category     | Default mode | Multi-tenant admin | Multi-tenant tenant |
| -------------------- | ------------ | ------------------ | ------------------- |
| **Configuration**    | Full         | Full               | Self (overlay)      |
| **Agent management** | Full         | Full               | Self                |
| **Session control**  | Full         | Full               | Self (read-only)    |
| **Terminal access**  | Full         | Full               | Self                |
| **Canvas/UI**        | Full         | Full               | Self                |
| **Cron jobs**        | Full         | Full               | Self                |
| **Skills**           | Full         | Full               | Self                |
| **Channels**         | Full         | Full               | Self                |
| **Pairing**          | Full         | Full               | Self                |
| **Backups**          | N/A          | Full               | Self                |
| **Usage/quotas**     | N/A          | Full               | Self                |

## Detailed breakdown

### Terminal access

| Operation         | Default | Admin     | Tenant             |
| ----------------- | ------- | --------- | ------------------ |
| `terminal.spawn`  | Yes     | Yes       | Yes (own sandbox)  |
| `terminal.write`  | Yes     | Yes       | Yes (own sessions) |
| `terminal.resize` | Yes     | Yes       | Yes (own sessions) |
| `terminal.close`  | Yes     | Yes       | Yes (own sessions) |
| `terminal.list`   | Yes     | Yes (all) | Yes (own only)     |

Tenants can only spawn terminals in their own sandbox (`~/.openclaw/tenants/{tenantId}/workspace`).

### Configuration management

| Operation       | Default | Admin | Tenant              |
| --------------- | ------- | ----- | ------------------- |
| `config.get`    | Yes     | Yes   | Yes (merged config) |
| `config.set`    | Yes     | Yes   | Yes (overlay only)  |
| `config.patch`  | Yes     | Yes   | Yes (overlay only)  |
| `config.apply`  | Yes     | Yes   | **No**              |
| `config.schema` | Yes     | Yes   | Yes                 |

- `config.get` returns the merged config (base + tenant overlay).
- `config.set/patch` write to the tenant's overlay at `{tenantDir}/openclaw.json`.
- Admin-only keys (`gateway`, `providers`, `meta`) are filtered from tenant writes.
- Tenants cannot trigger gateway restarts via config changes.

### Agent management

| Operation           | Default | Admin | Tenant                   |
| ------------------- | ------- | ----- | ------------------------ |
| `agents.list`       | Yes     | Yes   | Yes (from merged config) |
| `agents.create`     | Yes     | Yes   | Yes (tenant-isolated)    |
| `agents.update`     | Yes     | Yes   | Yes (tenant-isolated)    |
| `agents.delete`     | Yes     | Yes   | Yes (tenant-isolated)    |
| `agents.files.list` | Yes     | Yes   | Yes (tenant-isolated)    |
| `agents.files.get`  | Yes     | Yes   | Yes (tenant-isolated)    |
| `agents.files.set`  | Yes     | Yes   | Yes (tenant-isolated)    |
| `agent` (chat)      | Yes     | Yes   | **No**                   |
| `agent.identity.*`  | Yes     | Yes   | **No**                   |

Tenants can interact with agents via the terminal interface; the `agent` chat method itself is admin-only.

### Session management

| Operation          | Default | Admin | Tenant             |
| ------------------ | ------- | ----- | ------------------ |
| `sessions.list`    | Yes     | Yes   | Yes (own sessions) |
| `sessions.preview` | Yes     | Yes   | Yes (own sessions) |
| `sessions.patch`   | Yes     | Yes   | **No**             |
| `sessions.reset`   | Yes     | Yes   | **No**             |
| `sessions.delete`  | Yes     | Yes   | **No**             |
| `sessions.compact` | Yes     | Yes   | **No**             |

Session keys are auto-namespaced with `tenant:{tenantId}:` at HTTP entry points.

### Cron jobs

All `cron.*` methods are available to tenants and run in tenant-isolated storage at `{tenantDir}/cron/jobs.json`.

### Skills & plugins

All `skills.*` methods are available to tenants. Skills are installed in `{tenantDir}/workspace/` and binary requirements are tracked per skill.

### Channel operations

| Operation         | Default | Admin | Tenant                |
| ----------------- | ------- | ----- | --------------------- |
| `channels.status` | Yes     | Yes   | Yes (tenant-isolated) |
| `channels.start`  | Yes     | Yes   | Yes (tenant-isolated) |
| `channels.stop`   | Yes     | Yes   | Yes (tenant-isolated) |
| `channels.logout` | Yes     | Yes   | Yes (tenant-isolated) |
| `send` (message)  | Yes     | Yes   | **No**                |
| `chat.send`       | Yes     | Yes   | **No**                |

Tenants can manage their own channel connections. Direct message sending (`send`, `chat.send`) requires admin scope.

### Device & node pairing

All `device.*` and `node.*` pairing methods are available to tenants in isolated form.

### Canvas / UI access

Tenants can access `/a2ui/*`, `/canvas-host/*`, and `/canvas/ws` with bearer-token auth; resources are tenant-scoped.

### Tenant self-management

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

`tenants.delete` allows self-deletion with `confirm: true` (always deletes data). `tenants.restore` allows restoring own backups (cannot use `createIfMissing`).

### System operations

| Operation      | Default | Admin | Tenant |
| -------------- | ------- | ----- | ------ |
| `health`       | Yes     | Yes   | Yes    |
| `status`       | Yes     | Yes   | **No** |
| `logs.tail`    | Yes     | Yes   | **No** |
| `models.list`  | Yes     | Yes   | **No** |
| `usage.status` | Yes     | Yes   | **No** |
| `update.run`   | Yes     | Yes   | **No** |
| `wizard.*`     | Yes     | Yes   | **No** |

Tenants can only call `health`. All other system operations are blocked.

## Quota system (tenant only)

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

Quotas only apply to tenants. Default mode has no built-in quotas.

## Scope comparison

### Default mode scopes

| Scope                | Purpose                     |
| -------------------- | --------------------------- |
| `operator.admin`     | Full system access          |
| `operator.read`      | Read-only operations        |
| `operator.write`     | Read + write operations     |
| `operator.approvals` | Execution approval handling |
| `operator.pairing`   | Device/node pairing         |

### Tenant token scopes

Tenant tokens do **not** use the scope system. Authorization is based solely on:

1. Is it a tenant token? (`client.tenantId` is set)
2. Is the method in `TENANT_ALLOWED_METHODS`?
3. Does the tenant own the resource? (`canAccessTenant()`)

## Summary

### What tenants CAN do

1. Spawn and interact with terminals in their sandbox.
2. Read merged config, write to their overlay.
3. Create, update, delete, and manage agent files.
4. List and preview their own sessions.
5. Full cron job management with auto-scheduling.
6. Install and manage skills in their workspace.
7. Start, stop, and manage channel connections.
8. Configure voice wake settings.
9. Pair and manage devices and nodes.
10. Access canvas UI with tenant-scoped resources.
11. Check token usage, costs, quota status.
12. Export tenant data to S3-compatible storage.
13. Enumerate, restore, and delete (not from server) their own backups.
14. Rotate their token.
15. Retrieve their tenant metadata.
16. Delete their own tenant (with confirmation).
17. Call the health endpoint.

### What tenants CANNOT do

1. Patch, reset, delete, or compact sessions.
2. Use `send` or `chat.send` for direct messages.
3. Enumerate or access other tenants.
4. Delete backups via admin endpoints.
5. Read global logs/status (only health check).
6. Modify gateway, providers, or meta config.
