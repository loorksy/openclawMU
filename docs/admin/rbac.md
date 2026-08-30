---
title: Admin RBAC
summary: Super Admin, Admin, and Moderator permissions
---

# Admin RBAC

Permissions are enforced on the server for every `/admin/api` request.

| Permission                                 | Super Admin | Admin | Moderator             |
| ------------------------------------------ | ----------- | ----- | --------------------- |
| `tenants.read`                             | yes         | yes   | yes                   |
| `tenants.create`                           | yes         | yes   | no                    |
| `tenants.update`                           | yes         | yes   | suspend/activate only |
| `tenants.delete`                           | yes         | yes   | no                    |
| `users.read` / `users.write`               | yes         | yes   | read only             |
| `sessions.read` / `sessions.terminate`     | yes         | yes   | read only             |
| `usage.read` / `quotas.read`               | yes         | yes   | yes                   |
| `quotas.write`                             | yes         | yes   | no                    |
| `logs.read` / `audit.read` / `system.read` | yes         | yes   | yes                   |
| `system.write` / `settings.manage`         | yes         | no    | no                    |
| `moderators.manage`                        | yes         | yes   | no                    |
| `admins.manage`                            | yes         | no    | no                    |
| `staff.read`                               | yes         | yes   | no                    |

Admins cannot create or delete Super Admins. Frontend hiding is not authorization.
