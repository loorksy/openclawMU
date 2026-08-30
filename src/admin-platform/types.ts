/**
 * OPENCLAWMU ADDITION: Admin Platform domain types.
 * Independent of tenant tokens and Control UI operator scopes.
 */

export const ADMIN_ROLES = ["super_admin", "admin", "moderator"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
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
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export type AdminStaffRecord = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  passwordHash: string;
  disabled?: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  totpEnabled?: boolean;
  totpSecretEnc?: string;
};

export type AdminStaffPublic = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  totpEnabled: boolean;
};

export type AdminStaffStoreFile = {
  version: 1;
  staff: Record<string, AdminStaffRecord>;
};

export type AdminSessionRecord = {
  id: string;
  staffId: string;
  tokenHash: string;
  csrfToken: string;
  createdAt: string;
  expiresAt: string;
  ip?: string;
  userAgent?: string;
};

export type AdminSessionStoreFile = {
  version: 1;
  sessions: Record<string, AdminSessionRecord>;
};

export type AdminAuditEvent = {
  id: string;
  ts: string;
  actorId: string;
  actorEmail: string;
  role: AdminRole;
  action: string;
  targetType: string;
  targetId?: string;
  result: "ok" | "error" | "denied";
  ip?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type AdminAuthContext = {
  staff: AdminStaffPublic;
  session: AdminSessionRecord;
};

export function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}

export function toPublicStaff(record: AdminStaffRecord): AdminStaffPublic {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role,
    disabled: Boolean(record.disabled),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastLoginAt: record.lastLoginAt,
    totpEnabled: Boolean(record.totpEnabled),
  };
}
