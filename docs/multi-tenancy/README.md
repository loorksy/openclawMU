# Multi-Tenancy

OpenClaw supports multi-tenancy, allowing multiple isolated users (tenants) to share a single gateway instance while maintaining complete data isolation.

## Features

- **Tenant Isolation**: Each tenant has isolated sessions, memory, plugins, and sandbox environments
- **Per-Tenant Authentication**: Each tenant gets a unique authentication token
- **Bubblewrap Sandbox**: Lightweight Linux user-namespace isolation (alternative to Docker)
- **Web Terminal**: Browser-based terminal access to tenant sandboxes via xterm.js
- **Backup/Restore**: S3-compatible backup and restore for tenant data

## Quick Start

### Create a Tenant

```bash
openclaw tenants create demo
```

This outputs a tenant token in the format `tenant:demo:xxxxx`.

### Connect as a Tenant

```bash
# Using environment variable
OPENCLAW_GATEWAY_TOKEN="tenant:demo:xxxxx" openclaw chat

# Using CLI argument
openclaw --remote-token "tenant:demo:xxxxx" chat
```

### List Tenants

```bash
openclaw tenants list
```

### Rotate Tenant Token

```bash
openclaw tenants token demo
```

### Remove a Tenant

```bash
openclaw tenants remove demo --force --delete-data
```

## Configuration

Multi-tenancy is enabled automatically when tenant tokens are used. No additional configuration is required.

### Optional Settings

```json5
{
  gateway: {
    multiTenancy: {
      enabled: true, // Enable multi-tenancy (default: auto)
      sandboxBackend: "bwrap", // "docker", "bwrap", or "auto"
    },
  },
}
```

## Data Isolation

Each tenant's data is stored in a separate directory:

```
~/.openclaw/
├── tenants.json           # Tenant registry
├── tenants/
│   ├── tenant-a/
│   │   ├── workspace/     # Working directory (mounts at /workspace in sandbox)
│   │   ├── agents/        # Agent sessions
│   │   ├── memory/        # Embedding database
│   │   ├── plugins/       # Installed plugins
│   │   └── sandboxes/     # Sandbox state
│   └── tenant-b/
│       └── (same structure)
```

## API Reference

### Gateway Methods

| Method           | Description              | Access              |
| ---------------- | ------------------------ | ------------------- |
| `tenants.list`   | List all tenants         | Admin only          |
| `tenants.create` | Create a new tenant      | Admin only          |
| `tenants.get`    | Get tenant info          | Admin or own tenant |
| `tenants.delete` | Delete a tenant          | Admin only          |
| `tenants.rotate` | Rotate tenant token      | Admin or own tenant |
| `tenants.update` | Update tenant properties | Admin only          |

### CLI Commands

```bash
openclaw tenants create <tenantId>   # Create a new tenant
openclaw tenants list                # List all tenants
openclaw tenants info <tenantId>     # Get tenant details
openclaw tenants token <tenantId>    # Rotate token
openclaw tenants remove <tenantId>   # Remove tenant
```

## Sandbox Backends

### Bubblewrap (bwrap)

Bubblewrap provides lightweight Linux user-namespace isolation without requiring root or a container runtime.

Install bubblewrap:

```bash
# Debian/Ubuntu
apt install bubblewrap

# Fedora
dnf install bubblewrap

# Arch
pacman -S bubblewrap
```

Features:

- User namespaces (no root required)
- Network isolation
- Read-only root filesystem
- Process and IPC isolation

### Docker

Docker provides full container isolation with cgroups, seccomp, and AppArmor support.

Features:

- Image management
- Cgroup resource limits
- Seccomp profiles
- AppArmor profiles

## Web Terminal

Tenants can access their sandbox environment through a web-based terminal using xterm.js.

The terminal connects via WebSocket to the gateway, which spawns an interactive shell inside the tenant's bwrap sandbox.

### Terminal Gateway Methods

| Method            | Description                   | Access                          |
| ----------------- | ----------------------------- | ------------------------------- |
| `terminal.spawn`  | Spawn a new terminal session  | Tenant auth required            |
| `terminal.write`  | Write data to a terminal      | Owner tenant or admin           |
| `terminal.resize` | Resize terminal (cols/rows)   | Owner tenant or admin           |
| `terminal.close`  | Close a terminal session      | Owner tenant or admin           |
| `terminal.list`   | List active terminal sessions | Tenant sees own, admin sees all |

### Terminal Events

The gateway broadcasts terminal events to connected clients:

- `terminal.output` - Terminal output data
- `terminal.exit` - Terminal process exited

### Usage Example

```typescript
// Using the xterm-terminal web component
import { XtermTerminal } from "@openclaw/ui/terminal";

const terminal = document.createElement("xterm-terminal");
terminal.gatewayUrl = "wss://gateway.example.com";
terminal.token = "tenant:demo:xxxxx";
terminal.autoConnect = true;
document.body.appendChild(terminal);
```

## Backup and Restore

Tenant data can be backed up to S3-compatible storage (AWS S3, MinIO, GCS, etc.).

### Backup Gateway Methods

| Method                   | Description            | Access                |
| ------------------------ | ---------------------- | --------------------- |
| `tenants.backup`         | Backup tenant to S3    | Owner tenant or admin |
| `tenants.restore`        | Restore tenant from S3 | Admin only            |
| `tenants.backups.list`   | List tenant backups    | Owner tenant or admin |
| `tenants.backups.delete` | Delete a backup        | Admin only            |

### Backup Configuration

All backup methods accept S3 configuration:

```typescript
{
  bucket: "my-backups",           // Required
  endpoint: "https://minio.local", // For S3-compatible
  region: "us-east-1",
  prefix: "openclaw-backups",
  accessKeyId: "...",             // Or use environment
  secretAccessKey: "..."
}
```

### CLI Usage

```bash
# Backup a tenant
openclaw tenants backup demo --bucket my-backups

# List backups
openclaw tenants backups demo --bucket my-backups

# Restore a tenant
openclaw tenants restore demo --bucket my-backups --key backups/demo/2026-02-08.tar.gz
```

## Security

- Tenant tokens are hashed using SHA-256 before storage
- Timing-safe comparison prevents timing attacks
- Sandbox isolation prevents cross-tenant access
- Network isolation prevents external access from sandboxes

## See Also

- [Sandboxing](../gateway/sandboxing.md)
- [Security](../gateway/security/index.md)
- [Backup/Restore](./backup-restore.md)
