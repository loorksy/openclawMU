/**
 * OPENCLAWMU ADDITION: file-backed staff store ({stateDir}/admin/staff.json).
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveAdminStaffPath } from "./paths.js";
import { hashPassword } from "./password.js";
import {
  isAdminRole,
  toPublicStaff,
  type AdminRole,
  type AdminStaffPublic,
  type AdminStaffRecord,
  type AdminStaffStoreFile,
} from "./types.js";
import { AdminConflictError, AdminNotFoundError, AdminValidationError } from "./permissions.js";

const EMPTY_STORE: AdminStaffStoreFile = { version: 1, staff: {} };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertEmail(email: string): string {
  const normalized = normalizeEmail(email);
  if (!EMAIL_RE.test(normalized)) {
    throw new AdminValidationError("Valid email is required");
  }
  return normalized;
}

export function loadStaffStore(env: NodeJS.ProcessEnv = process.env): AdminStaffStoreFile {
  const filePath = resolveAdminStaffPath(env);
  try {
    if (!fs.existsSync(filePath)) {
      return { version: 1, staff: {} };
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as AdminStaffStoreFile;
    if (parsed?.version !== 1 || typeof parsed.staff !== "object" || !parsed.staff) {
      return { version: 1, staff: {} };
    }
    return parsed;
  } catch {
    return { version: 1, staff: {} };
  }
}

export function saveStaffStore(
  store: AdminStaffStoreFile,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const filePath = resolveAdminStaffPath(env);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // best-effort
  }
}

export function listStaff(env: NodeJS.ProcessEnv = process.env): AdminStaffPublic[] {
  return Object.values(loadStaffStore(env).staff).map(toPublicStaff);
}

export function getStaffById(
  staffId: string,
  env: NodeJS.ProcessEnv = process.env,
): AdminStaffRecord | null {
  return loadStaffStore(env).staff[staffId] ?? null;
}

export function getStaffByEmail(
  email: string,
  env: NodeJS.ProcessEnv = process.env,
): AdminStaffRecord | null {
  const normalized = normalizeEmail(email);
  return Object.values(loadStaffStore(env).staff).find((entry) => entry.email === normalized) ?? null;
}

export async function createStaff(
  input: { email: string; name: string; role: AdminRole; password: string },
  env: NodeJS.ProcessEnv = process.env,
): Promise<AdminStaffPublic> {
  if (!isAdminRole(input.role)) {
    throw new AdminValidationError("Invalid role");
  }
  const email = assertEmail(input.email);
  const name = input.name.trim();
  if (!name) {
    throw new AdminValidationError("Name is required");
  }
  const store = loadStaffStore(env);
  if (Object.values(store.staff).some((entry) => entry.email === email)) {
    throw new AdminConflictError("Staff email already exists");
  }
  const now = new Date().toISOString();
  const record: AdminStaffRecord = {
    id: randomUUID(),
    email,
    name,
    role: input.role,
    passwordHash: await hashPassword(input.password),
    createdAt: now,
    updatedAt: now,
  };
  store.staff[record.id] = record;
  saveStaffStore(store, env);
  return toPublicStaff(record);
}

export async function updateStaff(
  staffId: string,
  updates: {
    name?: string;
    role?: AdminRole;
    disabled?: boolean;
    password?: string;
    lastLoginAt?: string;
    totpEnabled?: boolean;
    totpSecretEnc?: string | null;
  },
  env: NodeJS.ProcessEnv = process.env,
): Promise<AdminStaffPublic> {
  const store = loadStaffStore(env);
  const record = store.staff[staffId];
  if (!record) {
    throw new AdminNotFoundError("Staff not found");
  }
  if (updates.name !== undefined) {
    const name = updates.name.trim();
    if (!name) {
      throw new AdminValidationError("Name is required");
    }
    record.name = name;
  }
  if (updates.role !== undefined) {
    if (!isAdminRole(updates.role)) {
      throw new AdminValidationError("Invalid role");
    }
    record.role = updates.role;
  }
  if (updates.disabled !== undefined) {
    record.disabled = updates.disabled || undefined;
  }
  if (updates.password !== undefined) {
    record.passwordHash = await hashPassword(updates.password);
  }
  if (updates.lastLoginAt !== undefined) {
    record.lastLoginAt = updates.lastLoginAt;
  }
  if (updates.totpEnabled !== undefined) {
    record.totpEnabled = updates.totpEnabled || undefined;
  }
  if (updates.totpSecretEnc !== undefined) {
    record.totpSecretEnc = updates.totpSecretEnc ?? undefined;
  }
  record.updatedAt = new Date().toISOString();
  saveStaffStore(store, env);
  return toPublicStaff(record);
}

export function staffCount(env: NodeJS.ProcessEnv = process.env): number {
  return Object.keys(loadStaffStore(env).staff).length;
}

export { EMPTY_STORE };
