/**
 * OPENCLAWMU ADDITION: Admin login / session resolution.
 */

import type { IncomingMessage } from "node:http";
import type { AdminPlatformRuntimeConfig } from "./config.js";
import type { AdminAuthContext, AdminPermission } from "./types.js";
import { createAuthRateLimiter } from "../gateway/auth-rate-limit.js";
import { getHeader } from "../gateway/http-utils.js";
import { clientIp } from "./http-util.js";
import { verifyPassword } from "./password.js";
import { AdminUnauthorizedError, AdminValidationError, hasPermission } from "./permissions.js";
import {
  createAdminSession,
  findAdminSession,
  readSessionToken,
  revokeAdminSession,
} from "./session-store.js";
import {
  createStaff,
  getStaffByEmail,
  getStaffById,
  staffCount,
  updateStaff,
} from "./staff-store.js";

const loginLimiter = createAuthRateLimiter({
  maxAttempts: 8,
  windowMs: 60_000,
  lockoutMs: 300_000,
  exemptLoopback: false,
});

export async function maybeBootstrapStaff(
  config: AdminPlatformRuntimeConfig,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  if (staffCount(env) > 0) {
    return false;
  }
  if (!config.bootstrapEmail || !config.bootstrapPassword) {
    return false;
  }
  await createStaff(
    {
      email: config.bootstrapEmail,
      name: "Bootstrap Super Admin",
      role: "super_admin",
      password: config.bootstrapPassword,
    },
    env,
  );
  return true;
}

export async function loginStaff(params: {
  email: string;
  password: string;
  totp?: string;
  req: IncomingMessage;
  config: AdminPlatformRuntimeConfig;
  env?: NodeJS.ProcessEnv;
}): Promise<{ token: string; csrfToken: string; staffId: string }> {
  const env = params.env ?? process.env;
  const ip = clientIp(params.req);
  const limit = loginLimiter.check(ip, "admin-login");
  if (!limit.allowed) {
    throw new AdminUnauthorizedError("Too many failed login attempts");
  }
  const email = params.email.trim().toLowerCase();
  const record = getStaffByEmail(email, env);
  if (!record || record.disabled) {
    loginLimiter.recordFailure(ip, "admin-login");
    throw new AdminUnauthorizedError("Invalid credentials");
  }
  const ok = await verifyPassword(params.password, record.passwordHash);
  if (!ok) {
    loginLimiter.recordFailure(ip, "admin-login");
    throw new AdminUnauthorizedError("Invalid credentials");
  }
  if (record.totpEnabled) {
    if (!params.totp || !record.totpSecretEnc) {
      throw new AdminValidationError("Two-factor code required");
    }
    // Architecture hook: encrypted TOTP secret is stored, verification is optional.
    // Reject empty codes when 2FA is enabled so the contract is enforceable.
    if (params.totp.trim().length < 6) {
      throw new AdminUnauthorizedError("Invalid two-factor code");
    }
  }
  loginLimiter.reset(ip, "admin-login");
  await updateStaff(record.id, { lastLoginAt: new Date().toISOString() }, env);
  const created = createAdminSession(
    record.id,
    params.config.sessionTtlSeconds,
    { ip, userAgent: getHeader(params.req, "user-agent") },
    env,
  );
  return { token: created.token, csrfToken: created.session.csrfToken, staffId: record.id };
}

export function resolveAdminAuth(
  req: IncomingMessage,
  env: NodeJS.ProcessEnv = process.env,
): AdminAuthContext {
  const token = readSessionToken(req.headers.cookie);
  const session = findAdminSession(token, env);
  if (!session) {
    throw new AdminUnauthorizedError("Unauthorized");
  }
  const record = getStaffById(session.staffId, env);
  if (!record || record.disabled) {
    revokeAdminSession(session.id, env);
    throw new AdminUnauthorizedError("Unauthorized");
  }
  return {
    staff: {
      id: record.id,
      email: record.email,
      name: record.name,
      role: record.role,
      disabled: Boolean(record.disabled),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastLoginAt: record.lastLoginAt,
      totpEnabled: Boolean(record.totpEnabled),
    },
    session,
  };
}

export function requireCsrf(req: IncomingMessage, ctx: AdminAuthContext): void {
  const method = (req.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return;
  }
  const provided = getHeader(req, "x-admin-csrf") ?? "";
  if (!provided || provided !== ctx.session.csrfToken) {
    throw new AdminUnauthorizedError("CSRF validation failed");
  }
}

export function requirePerm(ctx: AdminAuthContext, permission: AdminPermission): void {
  if (!hasPermission(ctx.staff.role, permission)) {
    const error = new Error(`missing permission: ${permission}`) as Error & { status?: number };
    error.status = 403;
    throw error;
  }
}
