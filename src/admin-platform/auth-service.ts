/**
 * OPENCLAWMU ADDITION: Admin login / session resolution.
 */

import type { IncomingMessage } from "node:http";
import type { AdminAuthContext, AdminPermission, AdminRole } from "./types.js";
import { createAuthRateLimiter } from "../gateway/auth-rate-limit.js";
import { getHeader } from "../gateway/http-utils.js";
import { appendAuditEvent } from "./audit.js";
import { resolveAdminPlatformConfig, type AdminPlatformRuntimeConfig } from "./config.js";
import { clientIp } from "./http-util.js";
import { verifyPassword } from "./password.js";
import { AdminUnauthorizedError, hasPermission } from "./permissions.js";
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
  // Re-check inside createStaff's file lock so a second request cannot
  // overwrite an existing Super Admin or create a second bootstrap account.
  const created = await createStaff(
    {
      email: config.bootstrapEmail,
      name: "Bootstrap Super Admin",
      role: "super_admin",
      password: config.bootstrapPassword,
      bootstrapOnly: true,
    },
    env,
  );
  return Boolean(created);
}

function auditLoginFailure(params: { email: string; ip?: string; reason: string }): void {
  appendAuditEvent({
    actorId: "anonymous",
    actorEmail: params.email,
    role: "unauthenticated",
    action: "auth.login",
    targetType: "session",
    result: "denied",
    ip: params.ip,
    metadata: { reason: params.reason },
  });
}

export async function loginStaff(params: {
  email: string;
  password: string;
  req: IncomingMessage;
  config: AdminPlatformRuntimeConfig;
  env?: NodeJS.ProcessEnv;
}): Promise<{ token: string; csrfToken: string; staffId: string; email: string; role: AdminRole }> {
  const env = params.env ?? process.env;
  const ip = clientIp(params.req);
  const email = params.email.trim().toLowerCase();
  const limit = loginLimiter.check(ip, "admin-login");
  if (!limit.allowed) {
    auditLoginFailure({ email, ip, reason: "rate_limited" });
    throw new AdminUnauthorizedError("Too many failed login attempts");
  }
  const record = getStaffByEmail(email, env);
  if (!record || record.disabled) {
    loginLimiter.recordFailure(ip, "admin-login");
    auditLoginFailure({ email, ip, reason: "invalid_credentials" });
    throw new AdminUnauthorizedError("Invalid credentials");
  }
  const ok = await verifyPassword(params.password, record.passwordHash);
  if (!ok) {
    loginLimiter.recordFailure(ip, "admin-login");
    auditLoginFailure({ email, ip, reason: "invalid_credentials" });
    throw new AdminUnauthorizedError("Invalid credentials");
  }
  loginLimiter.reset(ip, "admin-login");
  await updateStaff(record.id, { lastLoginAt: new Date().toISOString() }, env);
  const created = createAdminSession(
    record.id,
    params.config.sessionTtlSeconds,
    params.config.sessionSecret,
    { ip, userAgent: getHeader(params.req, "user-agent") },
    env,
  );
  return {
    token: created.token,
    csrfToken: created.session.csrfToken,
    staffId: record.id,
    email: record.email,
    role: record.role,
  };
}

export function resolveAdminAuth(
  req: IncomingMessage,
  env: NodeJS.ProcessEnv = process.env,
): AdminAuthContext {
  const token = readSessionToken(req.headers.cookie);
  const secret = resolveAdminPlatformConfig(env).sessionSecret;
  const session = findAdminSession(token, secret, env);
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

export function resetAdminLoginLimiter(ip = "127.0.0.1"): void {
  loginLimiter.reset(ip, "admin-login");
}

export function requirePerm(ctx: AdminAuthContext, permission: AdminPermission): void {
  if (!hasPermission(ctx.staff.role, permission)) {
    const error = new Error(`missing permission: ${permission}`) as Error & { status?: number };
    error.status = 403;
    throw error;
  }
}
