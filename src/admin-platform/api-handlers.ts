/**
 * OPENCLAWMU ADDITION: Admin REST handlers (session already authorized).
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import { sendJson } from "../gateway/http-common.js";
import { loadConfig } from "../config/config.js";
import { updateSessionStore } from "../config/sessions.js";
import { getTenant, isValidTenantId } from "../tenants/index.js";
import { appendAuditEvent, auditFromContext, readAuditEvents } from "./audit.js";
import { clientIp, queryParams, readAdminJson, sendAdminError } from "./http-util.js";
import {
  AdminForbiddenError,
  AdminValidationError,
  canAssignRole,
  canManageStaffRecord,
  hasPermission,
} from "./permissions.js";
import { permissionsForRole } from "./permissions.js";
import { requirePerm } from "./auth-service.js";
import { createStaff, getStaffById, listStaff, updateStaff } from "./staff-store.js";
import { revokeStaffSessions } from "./session-store.js";
import {
  buildDashboard,
  buildTenantDetail,
  buildTenantList,
  buildUsageSummary,
  createAdminTenant,
  deleteAdminTenant,
  listTenantSessions,
  rotateAdminTenantToken,
  updateAdminTenant,
} from "./tenant-data.js";
import type { AdminAuthContext, AdminRole } from "./types.js";
import { isAdminRole } from "./types.js";
import type { TenantQuotas } from "../tenants/types.js";

function audit(
  ctx: AdminAuthContext,
  req: IncomingMessage,
  action: string,
  extra: { targetType: string; targetId?: string; result: "ok" | "error" | "denied"; metadata?: Record<string, string | number | boolean | null> },
) {
  auditFromContext(ctx, action, { ...extra, ip: clientIp(req) });
}

export async function handleAuthorizedApi(params: {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  ctx: AdminAuthContext;
}): Promise<void> {
  const { req, res, url, ctx } = params;
  const method = (req.method ?? "GET").toUpperCase();
  const route = url.pathname.replace(/^\/admin\/api/, "") || "/";

  if (route === "/auth/session" && method === "GET") {
    sendJson(res, 200, {
      staff: ctx.staff,
      csrfToken: ctx.session.csrfToken,
      permissions: permissionsForRole(ctx.staff.role),
    });
    return;
  }

  if (route === "/dashboard" && method === "GET") {
    requirePerm(ctx, "system.read");
    requirePerm(ctx, "tenants.read");
    sendJson(res, 200, { dashboard: await buildDashboard() });
    return;
  }

  if (route === "/tenants" && method === "GET") {
    requirePerm(ctx, "tenants.read");
    sendJson(res, 200, { tenants: await buildTenantList() });
    return;
  }

  if (route === "/tenants" && method === "POST") {
    requirePerm(ctx, "tenants.create");
    const body = await readAdminJson(req, res);
    if (!body) {
      return;
    }
    const tenantId = String(body.tenantId ?? "");
    const created = await createAdminTenant(tenantId, typeof body.displayName === "string" ? body.displayName : undefined);
    audit(ctx, req, "tenants.create", { targetType: "tenant", targetId: created.tenantId, result: "ok" });
    sendJson(res, 201, {
      tenantId: created.tenantId,
      createdAt: created.createdAt,
      token: created.token,
    });
    return;
  }

  const tenantMatch = route.match(/^\/tenants\/([^/]+)(?:\/(.+))?$/);
  if (tenantMatch) {
    const tenantId = decodeURIComponent(tenantMatch[1] ?? "");
    const action = tenantMatch[2];
    if (!isValidTenantId(tenantId) || !getTenant(tenantId)) {
      sendAdminError(res, 404, "Tenant not found");
      return;
    }

    if (!action && method === "GET") {
      requirePerm(ctx, "tenants.read");
      sendJson(res, 200, { tenant: await buildTenantDetail(tenantId) });
      return;
    }

    if (!action && method === "PATCH") {
      requirePerm(ctx, "tenants.update");
      const body = await readAdminJson(req, res);
      if (!body) {
        return;
      }
      if (ctx.staff.role === "moderator") {
        if (body.quotas !== undefined || body.displayName !== undefined) {
          throw new AdminForbiddenError("Moderators may only suspend or activate tenants");
        }
      }
      const updated = updateAdminTenant(tenantId, {
        displayName: typeof body.displayName === "string" ? body.displayName : undefined,
        disabled: typeof body.disabled === "boolean" ? body.disabled : undefined,
        quotas: body.quotas && typeof body.quotas === "object" ? (body.quotas as TenantQuotas) : undefined,
      });
      audit(ctx, req, "tenants.update", {
        targetType: "tenant",
        targetId: tenantId,
        result: "ok",
        metadata: { disabled: Boolean(updated?.disabled) },
      });
      sendJson(res, 200, { updated: true, tenantId, disabled: Boolean(updated?.disabled) });
      return;
    }

    if (!action && method === "DELETE") {
      requirePerm(ctx, "tenants.delete");
      const deleteData = url.searchParams.get("deleteData") === "true";
      deleteAdminTenant(tenantId, deleteData);
      audit(ctx, req, "tenants.delete", {
        targetType: "tenant",
        targetId: tenantId,
        result: "ok",
        metadata: { deleteData },
      });
      sendJson(res, 200, { deleted: true, tenantId });
      return;
    }

    if (action === "rotate" && method === "POST") {
      requirePerm(ctx, "users.write");
      const rotated = rotateAdminTenantToken(tenantId);
      audit(ctx, req, "tenants.rotate", { targetType: "tenant", targetId: tenantId, result: "ok" });
      sendJson(res, 200, { tenantId: rotated.tenantId, token: rotated.token });
      return;
    }
  }

  if (route === "/users" && method === "GET") {
    requirePerm(ctx, "users.read");
    const tenants = await buildTenantList();
    sendJson(res, 200, {
      users: tenants.map((row) => ({
        id: row.tenantId,
        identifier: row.tenantId,
        name: row.displayName,
        tenantId: row.tenantId,
        role: "tenant",
        status: row.status,
        createdAt: row.createdAt,
        lastLoginAt: row.lastActivity,
      })),
      note: "OpenClawMU has no separate end-user table; rows are tenant identities.",
    });
    return;
  }

  if (route === "/sessions" && method === "GET") {
    requirePerm(ctx, "sessions.read");
    const tenantId = queryParams(url).get("tenantId") ?? undefined;
    sendJson(res, 200, { sessions: listTenantSessions(tenantId || undefined) });
    return;
  }

  if (route.startsWith("/sessions/") && method === "DELETE") {
    requirePerm(ctx, "sessions.terminate");
    const key = decodeURIComponent(route.slice("/sessions/".length));
    if (!key) {
      throw new AdminValidationError("Session key required");
    }
    const cfg = loadConfig();
    const storePath =
      cfg.session?.store && typeof cfg.session.store === "string"
        ? cfg.session.store
        : undefined;
    if (!storePath) {
      sendAdminError(res, 404, "Session store not found");
      return;
    }
    let deleted = false;
    await updateSessionStore(storePath, (store) => {
      if (store[key]) {
        delete store[key];
        deleted = true;
      }
    });
    audit(ctx, req, "sessions.terminate", {
      targetType: "session",
      targetId: key,
      result: deleted ? "ok" : "error",
    });
    sendJson(res, 200, { deleted, key });
    return;
  }

  if (route === "/usage" && method === "GET") {
    requirePerm(ctx, "usage.read");
    const range = (queryParams(url).get("range") ?? "30d") as "today" | "7d" | "30d" | "custom";
    sendJson(res, 200, { usage: await buildUsageSummary(range) });
    return;
  }

  if (route === "/quotas" && method === "GET") {
    requirePerm(ctx, "quotas.read");
    sendJson(res, 200, { tenants: await buildTenantList() });
    return;
  }

  if (route.startsWith("/quotas/") && method === "PATCH") {
    requirePerm(ctx, "quotas.write");
    const tenantId = decodeURIComponent(route.slice("/quotas/".length));
    const body = await readAdminJson(req, res);
    if (!body) {
      return;
    }
    updateAdminTenant(tenantId, { quotas: body as TenantQuotas });
    audit(ctx, req, "quotas.update", { targetType: "tenant", targetId: tenantId, result: "ok" });
    sendJson(res, 200, { updated: true, tenantId });
    return;
  }

  if (route === "/system" && method === "GET") {
    requirePerm(ctx, "system.read");
    sendJson(res, 200, { dashboard: await buildDashboard() });
    return;
  }

  if (route === "/logs" && method === "GET") {
    requirePerm(ctx, "logs.read");
    const cfg = loadConfig();
    const logFile = typeof cfg.logging?.file === "string" ? cfg.logging.file : null;
    let lines: string[] = [];
    if (logFile && fs.existsSync(logFile)) {
      const raw = fs.readFileSync(logFile, "utf8");
      lines = raw.split("\n").filter(Boolean).slice(-200);
    }
    sendJson(res, 200, { lines, path: logFile ? "[configured]" : null });
    return;
  }

  if (route === "/audit" && method === "GET") {
    requirePerm(ctx, "audit.read");
    sendJson(res, 200, {
      events: readAuditEvents({
        limit: Number(queryParams(url).get("limit") ?? 200),
        actorId: queryParams(url).get("actorId") ?? undefined,
        action: queryParams(url).get("action") ?? undefined,
        targetId: queryParams(url).get("targetId") ?? undefined,
      }),
    });
    return;
  }

  if (route === "/staff" && method === "GET") {
    requirePerm(ctx, "staff.read");
    sendJson(res, 200, { staff: listStaff() });
    return;
  }

  if (route === "/staff" && method === "POST") {
    const body = await readAdminJson(req, res);
    if (!body) {
      return;
    }
    const role = String(body.role ?? "");
    if (!isAdminRole(role) || !canAssignRole(ctx.staff, role)) {
      throw new AdminForbiddenError("Cannot assign this role");
    }
    if (role === "super_admin" || role === "admin") {
      requirePerm(ctx, "admins.manage");
    } else {
      requirePerm(ctx, "moderators.manage");
    }
    const created = await createStaff({
      email: String(body.email ?? ""),
      name: String(body.name ?? ""),
      role,
      password: String(body.password ?? ""),
    });
    audit(ctx, req, "staff.create", { targetType: "staff", targetId: created.id, result: "ok", metadata: { role } });
    sendJson(res, 201, { staff: created });
    return;
  }

  const staffMatch = route.match(/^\/staff\/([^/]+)(?:\/(.+))?$/);
  if (staffMatch) {
    const staffId = staffMatch[1] ?? "";
    const action = staffMatch[2];
    const target = getStaffById(staffId);
    if (!target) {
      sendAdminError(res, 404, "Staff not found");
      return;
    }
    const publicTarget = {
      id: target.id,
      email: target.email,
      name: target.name,
      role: target.role,
      disabled: Boolean(target.disabled),
      createdAt: target.createdAt,
      updatedAt: target.updatedAt,
      lastLoginAt: target.lastLoginAt,
      totpEnabled: Boolean(target.totpEnabled),
    };

    if (action === "revoke" && method === "POST") {
      if (!canManageStaffRecord(ctx.staff, publicTarget) && ctx.staff.id !== staffId) {
        throw new AdminForbiddenError("Cannot revoke these sessions");
      }
      const revoked = revokeStaffSessions(staffId);
      audit(ctx, req, "staff.revoke", { targetType: "staff", targetId: staffId, result: "ok" });
      sendJson(res, 200, { revoked });
      return;
    }

    if (method === "PATCH") {
      if (!canManageStaffRecord(ctx.staff, publicTarget)) {
        throw new AdminForbiddenError("Cannot manage this account");
      }
      const body = await readAdminJson(req, res);
      if (!body) {
        return;
      }
      if (typeof body.role === "string") {
        if (!isAdminRole(body.role) || !canAssignRole(ctx.staff, body.role)) {
          throw new AdminForbiddenError("Cannot assign this role");
        }
      }
      const updated = await updateStaff(staffId, {
        name: typeof body.name === "string" ? body.name : undefined,
        role: typeof body.role === "string" ? (body.role as AdminRole) : undefined,
        disabled: typeof body.disabled === "boolean" ? body.disabled : undefined,
        password: typeof body.password === "string" ? body.password : undefined,
      });
      if (typeof body.password === "string" || body.disabled === true) {
        revokeStaffSessions(staffId);
      }
      audit(ctx, req, "staff.update", { targetType: "staff", targetId: staffId, result: "ok" });
      sendJson(res, 200, { staff: updated });
      return;
    }
  }

  sendAdminError(res, 404, "Not found");
}

export { appendAuditEvent };
