# Tenant Operations

CLI reference for managing tenants on an OpenClawMU gateway. All commands run with admin credentials unless noted otherwise.

## Lifecycle

```bash
openclaw tenants create <tenantId>   # Create a new tenant
openclaw tenants list                # List all tenants
openclaw tenants info <tenantId>     # Get tenant details
openclaw tenants token <tenantId>    # Rotate token
openclaw tenants remove <tenantId>   # Remove tenant
```

### Tenant ID format

- Pattern: `^[a-z0-9][a-z0-9_-]{0,31}$`
- Length: 1-32 characters.
- Characters: lowercase alphanumeric, hyphens, underscores.
- Examples: `demo`, `user-123`, `prod_tenant`.

### Connecting as a tenant

```bash
# Environment variable
OPENCLAW_GATEWAY_TOKEN="tenant:demo:xxxxx" openclaw chat

# CLI argument
openclaw --remote-token "tenant:demo:xxxxx" chat
```

### Removing a tenant

```bash
openclaw tenants remove demo --force --delete-data
```

`--delete-data` permanently removes `~/.openclaw/tenants/{tenantId}/`.

## Backup & restore

Tenant data is exported to S3-compatible storage (AWS S3, MinIO, GCS, etc.).

```bash
# Backup a tenant
openclaw tenants backup demo --bucket my-backups

# List backups
openclaw tenants backups demo --bucket my-backups

# Restore a tenant
openclaw tenants restore demo --bucket my-backups --key backups/demo/2026-02-08.tar.gz
```

S3 credentials are resolved server-side (IAM role, IRSA, server environment, etc.). The S3 config shape:

```typescript
{
  bucket: "my-backups",            // Required
  endpoint: "https://minio.local", // For S3-compatible
  region: "us-east-1",
  prefix: "openclaw-backups"
}
```

Security: path traversal protection in tar extraction, symlink validation before extraction, secure tar creation with explicit paths.

## Allowed gateway methods (tenant scope)

Tenants can only call these methods. All others are blocked with "method not available for tenant token".

| Category              | Methods                                                                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tenant management** | `tenants.get`, `tenants.rotate`, `tenants.backup`, `tenants.backups.list`, `tenants.restore`, `tenants.delete`, `tenants.usage`, `tenants.quota.status`, `tenants.usage.history` |
| **Terminal**          | `terminal.spawn`, `terminal.write`, `terminal.resize`, `terminal.close`, `terminal.list`                                                                                         |
| **Config**            | `config.get`, `config.set`, `config.patch`, `config.schema`                                                                                                                      |
| **Agents**            | `agents.list`, `agents.create`, `agents.update`, `agents.delete`, `agents.files.list`, `agents.files.get`, `agents.files.set`                                                    |
| **Sessions**          | `sessions.list`, `sessions.preview`                                                                                                                                              |
| **Cron**              | `cron.list`, `cron.add`, `cron.update`, `cron.remove`, `cron.status`, `cron.runs`, `cron.run`                                                                                    |
| **Skills**            | `skills.status`, `skills.bins`, `skills.install`, `skills.update`                                                                                                                |
| **Channels**          | `channels.status`, `channels.start`, `channels.stop`, `channels.logout`                                                                                                          |
| **Voice wake**        | `voicewake.get`, `voicewake.set`                                                                                                                                                 |
| **Devices**           | `device.pair.list`, `device.pair.approve`, `device.pair.reject`, `device.token.rotate`, `device.token.revoke`                                                                    |
| **Nodes**             | `node.pair.request`, `node.pair.list`, `node.pair.approve`, `node.pair.reject`, `node.pair.verify`, `node.rename`, `node.list`, `node.describe`, `node.invoke`                   |
| **Health**            | `health`                                                                                                                                                                         |

## Admin-only methods

These methods are blocked for tenant tokens:

- `wizard.*` — configuration wizard.
- `status`, `usage.status`, `usage.cost`, `logs.tail` — global status and logs.
- `tenants.list`, `tenants.create` — tenant administration.
- `sessions.patch`, `sessions.reset`, `sessions.delete`, `sessions.compact` — session modification.

## Internal HTTP API

For programmatic tenant management, the control plane HTTP API is available when `gateway.controlPlaneToken` is set:

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

Pass the token via the `X-Control-Plane-Token` header.

## See also

- [Multi-Tenancy overview](index.md).
- [Feature comparison](feature-comparison.md).
- [Gateway security](../gateway/security.md).
