/**
 * OPENCLAWMU ADDITION: Admin Platform RBAC matrix.
 */

import type { AdminPermission, AdminRole, AdminStaffPublic } from "./types.js";

const ALL: readonly AdminPermission[] = [
  "users.read",
  "users.write",
  "tenants.read",
  "tenants.create",
  "tenants.update",
  "tenants.delete",
  "sessions.read",
  "sessions.terminate",
  "usage.read",
  "logs.read",
  "system.read",
  "system.write",
  "admins.manage",
  "moderators.manage",
  "settings.manage",
  "quotas.read",
  "quotas.write",
  "staff.read",
  "audit.read",
];

const ADMIN_PERMS: readonly AdminPermission[] = ALL.filter(
  (perm) => perm !== "admins.manage" && perm !== "settings.manage" && perm !== "system.write",
);

const MODERATOR_PERMS: readonly AdminPermission[] = [
  "users.read",
  "tenants.read",
  "tenants.update",
  "sessions.read",
  "usage.read",
  "logs.read",
  "system.read",
  "quotas.read",
  "audit.read",
];

const ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<AdminPermission>> = {
  super_admin: new Set(ALL),
  admin: new Set(ADMIN_PERMS),
  moderator: new Set(MODERATOR_PERMS),
};

export function permissionsForRole(role: AdminRole): AdminPermission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function hasPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function canAssignRole(actor: AdminStaffPublic, targetRole: AdminRole): boolean {
  if (actor.role === "super_admin") {
    return true;
  }
  if (actor.role === "admin") {
    return targetRole === "moderator" || targetRole === "admin";
  }
  return false;
}

export function canManageStaffRecord(actor: AdminStaffPublic, target: AdminStaffPublic): boolean {
  if (actor.id === target.id) {
    return false;
  }
  if (target.role === "super_admin") {
    return actor.role === "super_admin" && hasPermission(actor.role, "admins.manage");
  }
  if (target.role === "admin") {
    return hasPermission(actor.role, "admins.manage");
  }
  return hasPermission(actor.role, "moderators.manage") || hasPermission(actor.role, "admins.manage");
}

export function assertPermission(role: AdminRole, permission: AdminPermission): void {
  if (!hasPermission(role, permission)) {
    throw new AdminForbiddenError(`missing permission: ${permission}`);
  }
}

export class AdminForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "AdminForbiddenError";
  }
}

export class AdminUnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AdminUnauthorizedError";
  }
}

export class AdminNotFoundError extends Error {
  readonly status = 404;
  constructor(message = "Not found") {
    super(message);
    this.name = "AdminNotFoundError";
  }
}

export class AdminValidationError extends Error {
  readonly status = 400;
  constructor(message = "Invalid request") {
    super(message);
    this.name = "AdminValidationError";
  }
}

export class AdminConflictError extends Error {
  readonly status = 409;
  constructor(message = "Conflict") {
    super(message);
    this.name = "AdminConflictError";
  }
}
