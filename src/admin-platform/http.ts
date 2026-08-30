/**
 * OPENCLAWMU ADDITION: Admin Platform HTTP entry (Host/domain isolated).
 */

import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { sendJson } from "../gateway/http-common.js";
import { getHeader } from "../gateway/http-utils.js";
import { handleAuthorizedApi } from "./api-handlers.js";
import { appendAuditEvent } from "./audit.js";
import { loginStaff, maybeBootstrapStaff, requireCsrf, resolveAdminAuth } from "./auth-service.js";
import {
  isAdminHostRequest,
  isAllowedOrigin,
  requestIsHttps,
  resolveAdminPlatformConfig,
  resolveTrustedProxyList,
} from "./config.js";
import {
  applyAdminSecurityHeaders,
  asString,
  clientIp,
  readAdminJson,
  sendAdminError,
} from "./http-util.js";
import { serveAdminUi } from "./serve-ui.js";
import { revokeAdminSession } from "./session-store.js";
import { buildSessionCookie } from "./session-store.js";

export type AdminHttpOptions = {
  dedicatedListener?: boolean;
  env?: NodeJS.ProcessEnv;
};

function writeError(res: ServerResponse, err: unknown): void {
  const status =
    typeof (err as { status?: number }).status === "number"
      ? (err as { status: number }).status
      : 500;
  const raw = err instanceof Error ? err.message : "Internal error";
  const message =
    status >= 500 ? "Internal error" : raw && raw.length < 200 ? raw : "Request failed";
  sendJson(res, status, { error: message });
}

export async function handleAdminPlatformHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AdminHttpOptions = {},
): Promise<boolean> {
  const env = options.env ?? process.env;
  const config = resolveAdminPlatformConfig(env);
  if (!config.enabled) {
    return false;
  }
  if (String(req.headers.upgrade ?? "").toLowerCase() === "websocket") {
    return false;
  }

  if (!isAdminHostRequest(req, config, Boolean(options.dedicatedListener))) {
    return false;
  }

  applyAdminSecurityHeaders(req, res, config);
  const method = (req.method ?? "GET").toUpperCase();
  const url = new URL(req.url ?? "/", "http://localhost");

  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }

  if (url.pathname === "/admin/api/health" && method === "GET") {
    sendJson(res, 200, { status: "ok", platform: "admin" });
    return true;
  }

  if (url.pathname.startsWith("/admin/api/")) {
    if (!config.sessionSecret) {
      sendAdminError(res, 503, "OPENCLAW_ADMIN_SESSION_SECRET is required");
      return true;
    }
    try {
      await maybeBootstrapStaff(config, env);
      if (url.pathname === "/admin/api/auth/login" && method === "POST") {
        const origin = getHeader(req, "origin");
        if (origin && !isAllowedOrigin(origin, config)) {
          sendAdminError(res, 403, "Origin not allowed");
          return true;
        }
        const body = await readAdminJson(req, res);
        if (!body) {
          return true;
        }
        const result = await loginStaff({
          email: asString(body.email),
          password: asString(body.password),
          req,
          config,
          env,
        });
        const trustedProxies = resolveTrustedProxyList();
        res.setHeader(
          "Set-Cookie",
          buildSessionCookie(result.token, {
            ttlSeconds: config.sessionTtlSeconds,
            secure: config.cookieSecure || requestIsHttps(req, trustedProxies),
            sameSite: config.cookieSameSite,
          }),
        );
        appendAuditEvent({
          actorId: result.staffId,
          actorEmail: result.email,
          role: result.role,
          action: "auth.login",
          targetType: "session",
          result: "ok",
          ip: clientIp(req),
        });
        sendJson(res, 200, { ok: true, csrfToken: result.csrfToken });
        return true;
      }

      const ctx = resolveAdminAuth(req, env);
      requireCsrf(req, ctx);

      if (url.pathname === "/admin/api/auth/logout" && method === "POST") {
        revokeAdminSession(ctx.session.id, env);
        res.setHeader(
          "Set-Cookie",
          buildSessionCookie("", {
            ttlSeconds: 0,
            secure: config.cookieSecure || requestIsHttps(req, resolveTrustedProxyList()),
            sameSite: config.cookieSameSite,
            clear: true,
          }),
        );
        appendAuditEvent({
          actorId: ctx.staff.id,
          actorEmail: ctx.staff.email,
          role: ctx.staff.role,
          action: "auth.logout",
          targetType: "session",
          result: "ok",
          ip: clientIp(req),
        });
        sendJson(res, 200, { ok: true });
        return true;
      }

      await handleAuthorizedApi({ req, res, url, ctx });
    } catch (err) {
      writeError(res, err);
    }
    return true;
  }

  if (method === "GET" || method === "HEAD") {
    serveAdminUi(req, res);
    return true;
  }

  sendAdminError(res, 405, "Method not allowed");
  return true;
}

export function createAdminPlatformHttpServer(env: NodeJS.ProcessEnv = process.env) {
  return createHttpServer((req, res) => {
    void handleAdminPlatformHttpRequest(req, res, { dedicatedListener: true, env }).then(
      (handled) => {
        if (!handled) {
          res.statusCode = 404;
          res.end("Not Found");
        }
      },
    );
  });
}
