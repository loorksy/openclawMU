import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { createServer, request as nodeRequest } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearConfigCache } from "../config/config.js";
import { handleInternalHttpRequest } from "../gateway/internal-http.js";
import { createTenant } from "../tenants/index.js";
import { resetAdminLoginLimiter } from "./auth-service.js";
import { handleAdminPlatformHttpRequest } from "./http.js";
import { hashPassword, verifyPassword } from "./password.js";
import { hasPermission, canAssignRole, canManageStaffRecord } from "./permissions.js";
import { createStaff, getStaffByEmail, staffCount } from "./staff-store.js";

const DOMAIN = "admin.test.local";

function setAdminEnv(root: string) {
  process.env.OPENCLAW_HOME = root;
  process.env.OPENCLAW_STATE_DIR = path.join(root, ".openclaw");
  process.env.OPENCLAW_CONFIG_PATH = path.join(root, ".openclaw", "openclaw.json");
  process.env.OPENCLAW_ADMIN_DOMAIN = DOMAIN;
  process.env.OPENCLAW_ADMIN_SESSION_SECRET = "test-admin-session-secret-32bytes-min";
  process.env.OPENCLAW_ADMIN_COOKIE_SECURE = "0";
  process.env.OPENCLAW_ADMIN_COOKIE_SAME_SITE = "lax";
  process.env.OPENCLAW_ADMIN_ALLOWED_ORIGINS = `http://${DOMAIN}`;
  mkdirSync(path.join(root, ".openclaw"), { recursive: true });
  writeFileSync(process.env.OPENCLAW_CONFIG_PATH, "{}\n");
  clearConfigCache();
}

async function startServer() {
  const server = createServer((req, res) => {
    void handleAdminPlatformHttpRequest(req, res, { dedicatedListener: true });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("no port");
  }
  return { server, port: address.port };
}

async function request(
  port: number,
  method: string,
  pathname: string,
  opts: {
    body?: unknown;
    cookie?: string;
    csrf?: string;
    host?: string;
    origin?: string;
    forwardedHost?: string;
    forwardedProto?: string;
    authorization?: string;
  } = {},
) {
  const headers: Record<string, string> = {
    Host: opts.host ?? DOMAIN,
  };
  if (opts.origin !== undefined) {
    if (opts.origin) {
      headers.Origin = opts.origin;
    }
  } else {
    headers.Origin = `http://${DOMAIN}`;
  }
  if (opts.cookie) {
    headers.cookie = opts.cookie;
  }
  if (opts.csrf) {
    headers["X-Admin-CSRF"] = opts.csrf;
  }
  if (opts.forwardedHost) {
    headers["X-Forwarded-Host"] = opts.forwardedHost;
  }
  if (opts.forwardedProto) {
    headers["X-Forwarded-Proto"] = opts.forwardedProto;
  }
  if (opts.authorization) {
    headers.authorization = opts.authorization;
  }
  if (opts.body) {
    headers["content-type"] = "application/json";
  }
  const res = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: "manual",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return {
    status: res.status,
    data,
    setCookie: res.headers.get("set-cookie"),
    allowOrigin: res.headers.get("access-control-allow-origin"),
    allowCredentials: res.headers.get("access-control-allow-credentials"),
  };
}

function cookieFrom(setCookie: string | null): string {
  return setCookie?.split(";")[0] ?? "";
}

async function rawRequest(
  port: number,
  method: string,
  pathname: string,
  headers: Record<string, string>,
  body?: string,
): Promise<{ status: number; data: Record<string, unknown>; raw: string }> {
  return await new Promise((resolve, reject) => {
    const req = nodeRequest({ host: "127.0.0.1", port, path: pathname, method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          data = { text: raw };
        }
        resolve({ status: res.statusCode ?? 0, data, raw });
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

describe("admin platform", () => {
  let prev: Record<string, string | undefined> = {};
  const keys = [
    "OPENCLAW_HOME",
    "OPENCLAW_STATE_DIR",
    "OPENCLAW_CONFIG_PATH",
    "OPENCLAW_ADMIN_DOMAIN",
    "OPENCLAW_ADMIN_SESSION_SECRET",
    "OPENCLAW_ADMIN_COOKIE_SECURE",
    "OPENCLAW_ADMIN_COOKIE_SAME_SITE",
    "OPENCLAW_ADMIN_ALLOWED_ORIGINS",
    "OPENCLAW_ADMIN_BOOTSTRAP_EMAIL",
    "OPENCLAW_ADMIN_BOOTSTRAP_PASSWORD",
  ];

  beforeEach(() => {
    prev = {};
    for (const key of keys) {
      prev[key] = process.env[key];
    }
    setAdminEnv(mkdtempSync(path.join(tmpdir(), "oc-admin-")));
  });

  afterEach(() => {
    for (const key of keys) {
      if (prev[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = prev[key];
      }
    }
    clearConfigCache();
    resetAdminLoginLimiter();
  });

  it("hashes passwords and never stores plaintext", async () => {
    const hash = await hashPassword("super-secret-12");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash.includes("super-secret-12")).toBe(false);
    expect(await verifyPassword("super-secret-12", hash)).toBe(true);
    expect(await verifyPassword("wrong-password-12", hash)).toBe(false);
  });

  it("enforces RBAC matrix", () => {
    expect(hasPermission("moderator", "tenants.read")).toBe(true);
    expect(hasPermission("moderator", "admins.manage")).toBe(false);
    expect(hasPermission("admin", "tenants.delete")).toBe(true);
    expect(hasPermission("admin", "admins.manage")).toBe(false);
    expect(hasPermission("admin", "settings.manage")).toBe(false);
    expect(hasPermission("admin", "system.write")).toBe(false);
    expect(hasPermission("moderator", "quotas.write")).toBe(false);
    expect(hasPermission("moderator", "tenants.delete")).toBe(false);
    expect(hasPermission("super_admin", "admins.manage")).toBe(true);
    const admin = {
      id: "a",
      email: "a@x.com",
      name: "A",
      role: "admin" as const,
      disabled: false,
      createdAt: "",
      updatedAt: "",
    };
    expect(canAssignRole(admin, "super_admin")).toBe(false);
    expect(
      canManageStaffRecord(admin, {
        ...admin,
        id: "s",
        role: "super_admin",
      }),
    ).toBe(false);
  });

  it("rejects unauthenticated admin API", async () => {
    const { server, port } = await startServer();
    try {
      const res = await request(port, "GET", "/admin/api/tenants");
      expect(res.status).toBe(401);
    } finally {
      server.close();
    }
  });

  it("rejects tenant tokens as admin credentials", async () => {
    const { server, port } = await startServer();
    try {
      const res = await request(port, "GET", "/admin/api/tenants", {
        cookie: "openclaw_admin_session=tenant:demo:not-an-admin",
      });
      expect(res.status).toBe(401);
    } finally {
      server.close();
    }
  });

  it("rejects login failure and then allows valid Super Admin", async () => {
    await createStaff({
      email: "root@example.com",
      name: "Root",
      role: "super_admin",
      password: "super-secret-12",
    });
    const { server, port } = await startServer();
    try {
      const failed = await request(port, "POST", "/admin/api/auth/login", {
        body: { email: "root@example.com", password: "nope-nope-nope" },
      });
      expect(failed.status).toBe(401);

      const login = await request(port, "POST", "/admin/api/auth/login", {
        body: { email: "root@example.com", password: "super-secret-12" },
      });
      expect(login.status).toBe(200);
      const cookie = cookieFrom(login.setCookie);
      const csrf = String(login.data.csrfToken);
      const session = await request(port, "GET", "/admin/api/auth/session", { cookie, csrf });
      expect(session.status).toBe(200);
      expect((session.data.staff as { role: string }).role).toBe("super_admin");
    } finally {
      server.close();
    }
  });

  it("blocks mutating requests without CSRF", async () => {
    await createStaff({
      email: "root@example.com",
      name: "Root",
      role: "super_admin",
      password: "super-secret-12",
    });
    const { server, port } = await startServer();
    try {
      const login = await request(port, "POST", "/admin/api/auth/login", {
        body: { email: "root@example.com", password: "super-secret-12" },
      });
      const cookie = cookieFrom(login.setCookie);
      const created = await request(port, "POST", "/admin/api/tenants", {
        cookie,
        body: { tenantId: "acme" },
      });
      expect(created.status).toBe(401);
    } finally {
      server.close();
    }
  });

  it("lets Super Admin create tenants and isolates missing tenants as 404", async () => {
    await createStaff({
      email: "root@example.com",
      name: "Root",
      role: "super_admin",
      password: "super-secret-12",
    });
    const { server, port } = await startServer();
    try {
      const login = await request(port, "POST", "/admin/api/auth/login", {
        body: { email: "root@example.com", password: "super-secret-12" },
      });
      const cookie = cookieFrom(login.setCookie);
      const csrf = String(login.data.csrfToken);
      const created = await request(port, "POST", "/admin/api/tenants", {
        cookie,
        csrf,
        body: { tenantId: "acme", displayName: "Acme" },
      });
      expect(created.status).toBe(201);
      expect(created.data.token).toMatch(/^tenant:acme:/);

      const missing = await request(port, "GET", "/admin/api/tenants/other", { cookie, csrf });
      expect(missing.status).toBe(404);

      const listed = await request(port, "GET", "/admin/api/tenants", { cookie, csrf });
      expect(listed.status).toBe(200);
      expect(
        (listed.data.tenants as { tenantId: string }[]).some((row) => row.tenantId === "acme"),
      ).toBe(true);
    } finally {
      server.close();
    }
  });

  it("prevents moderator from managing admins", async () => {
    await createStaff({
      email: "root@example.com",
      name: "Root",
      role: "super_admin",
      password: "super-secret-12",
    });
    await createStaff({
      email: "mod@example.com",
      name: "Mod",
      role: "moderator",
      password: "moderator-pass-12",
    });
    const { server, port } = await startServer();
    try {
      const login = await request(port, "POST", "/admin/api/auth/login", {
        body: { email: "mod@example.com", password: "moderator-pass-12" },
      });
      const cookie = cookieFrom(login.setCookie);
      const csrf = String(login.data.csrfToken);
      const createAdmin = await request(port, "POST", "/admin/api/staff", {
        cookie,
        csrf,
        body: {
          email: "new-admin@example.com",
          name: "Nope",
          role: "admin",
          password: "another-pass-12",
        },
      });
      expect(createAdmin.status).toBe(403);

      createTenant("alpha");
      const deleted = await request(port, "DELETE", "/admin/api/tenants/alpha", { cookie, csrf });
      expect(deleted.status).toBe(403);
    } finally {
      server.close();
    }
  });

  it("prevents admin from creating Super Admin", async () => {
    await createStaff({
      email: "ops@example.com",
      name: "Ops",
      role: "admin",
      password: "admin-secret-12",
    });
    const { server, port } = await startServer();
    try {
      const login = await request(port, "POST", "/admin/api/auth/login", {
        body: { email: "ops@example.com", password: "admin-secret-12" },
      });
      const cookie = cookieFrom(login.setCookie);
      const csrf = String(login.data.csrfToken);
      const created = await request(port, "POST", "/admin/api/staff", {
        cookie,
        csrf,
        body: {
          email: "root2@example.com",
          name: "Root2",
          role: "super_admin",
          password: "super-secret-12",
        },
      });
      expect(created.status).toBe(403);
    } finally {
      server.close();
    }
  });

  it("invalidates sessions after logout", async () => {
    await createStaff({
      email: "root@example.com",
      name: "Root",
      role: "super_admin",
      password: "super-secret-12",
    });
    const { server, port } = await startServer();
    try {
      const login = await request(port, "POST", "/admin/api/auth/login", {
        body: { email: "root@example.com", password: "super-secret-12" },
      });
      const cookie = cookieFrom(login.setCookie);
      const csrf = String(login.data.csrfToken);
      await request(port, "POST", "/admin/api/auth/logout", { cookie, csrf });
      const again = await request(port, "GET", "/admin/api/auth/session", { cookie, csrf });
      expect(again.status).toBe(401);
    } finally {
      server.close();
    }
  });

  it("writes audit events without secrets", async () => {
    await createStaff({
      email: "root@example.com",
      name: "Root",
      role: "super_admin",
      password: "super-secret-12",
    });
    expect(staffCount()).toBe(1);
    const { server, port } = await startServer();
    try {
      const login = await request(port, "POST", "/admin/api/auth/login", {
        body: { email: "root@example.com", password: "super-secret-12" },
      });
      const cookie = cookieFrom(login.setCookie);
      const csrf = String(login.data.csrfToken);
      await request(port, "POST", "/admin/api/tenants", {
        cookie,
        csrf,
        body: { tenantId: "beta", displayName: "Beta" },
      });
      const audit = await request(port, "GET", "/admin/api/audit", { cookie, csrf });
      expect(audit.status).toBe(200);
      const events = audit.data.events as { action: string; metadata?: Record<string, unknown> }[];
      expect(events.some((event) => event.action === "tenants.create")).toBe(true);
      expect(JSON.stringify(events)).not.toContain("super-secret-12");
    } finally {
      server.close();
    }
  });

  it("does not serve admin API on a non-admin host when not dedicated", async () => {
    const server = createServer((req, res) => {
      void handleAdminPlatformHttpRequest(req, res, { dedicatedListener: false }).then(
        (handled) => {
          if (!handled) {
            res.statusCode = 204;
            res.end();
          }
        },
      );
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("no port");
    }
    try {
      const res = await rawRequest(address.port, "GET", "/admin/api/health", {
        host: "app.test.local",
      });
      expect(res.status).toBe(204);
    } finally {
      server.close();
    }
  });

  it("routes admin.example.com to Admin and leaves app.example.com for Control UI / internal API", async () => {
    const server = createServer((req, res) => {
      void (async () => {
        if (await handleAdminPlatformHttpRequest(req, res, { dedicatedListener: false })) {
          return;
        }
        if (await handleInternalHttpRequest(req, res)) {
          return;
        }
        res.statusCode = 200;
        res.setHeader("content-type", "text/plain");
        res.end("control-ui");
      })();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("no port");
    }
    try {
      const adminHealth = await rawRequest(address.port, "GET", "/admin/api/health", {
        host: DOMAIN,
      });
      expect(adminHealth.status).toBe(200);
      expect(adminHealth.data.platform).toBe("admin");

      const appAdmin = await rawRequest(address.port, "GET", "/admin/api/health", {
        host: "app.example.com",
      });
      expect(appAdmin.status).toBe(200);
      expect(appAdmin.data.platform).toBeUndefined();
      expect(appAdmin.raw).toBe("control-ui");

      const otherHost = await rawRequest(
        address.port,
        "POST",
        "/admin/api/auth/login",
        { host: "other.example.com", "content-type": "application/json" },
        JSON.stringify({ email: "x@y.com", password: "nope-nope-nope" }),
      );
      expect(otherHost.status).toBe(200);
      expect(otherHost.data.ok).toBeUndefined();
      expect(otherHost.raw).toBe("control-ui");

      const internal = await rawRequest(address.port, "GET", "/internal/v1/status", {
        host: "app.example.com",
      });
      expect(internal.status).toBe(401);
      expect(internal.data.error).toBe("unauthorized");
    } finally {
      server.close();
    }
  });

  it("ignores spoofed X-Forwarded-Host unless the peer is a trusted proxy", async () => {
    const server = createServer((req, res) => {
      void handleAdminPlatformHttpRequest(req, res, { dedicatedListener: false }).then(
        (handled) => {
          if (!handled) {
            res.statusCode = 204;
            res.end();
          }
        },
      );
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("no port");
    }
    try {
      const spoofed = await rawRequest(address.port, "GET", "/admin/api/health", {
        host: "app.example.com",
        "x-forwarded-host": DOMAIN,
      });
      expect(spoofed.status).toBe(204);

      writeFileSync(
        process.env.OPENCLAW_CONFIG_PATH!,
        JSON.stringify({ gateway: { trustedProxies: ["127.0.0.1"] } }),
      );
      clearConfigCache();

      const trusted = await rawRequest(address.port, "GET", "/admin/api/health", {
        host: "127.0.0.1",
        "x-forwarded-host": DOMAIN,
      });
      expect(trusted.status).toBe(200);
      expect(trusted.data.platform).toBe("admin");
    } finally {
      server.close();
    }
  });

  it("does not consume WebSocket upgrades on the Admin Host", async () => {
    let handled = true;
    const req = {
      method: "GET",
      url: "/admin/api/health",
      headers: { host: DOMAIN, upgrade: "websocket" },
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as import("node:http").IncomingMessage;
    const res = {
      setHeader() {},
      end() {},
    } as unknown as import("node:http").ServerResponse;
    handled = await handleAdminPlatformHttpRequest(req, res, { dedicatedListener: false });
    expect(handled).toBe(false);
  });

  it("rejects CORS credentials for unknown origins and never uses *", async () => {
    const { server, port } = await startServer();
    try {
      const denied = await request(port, "GET", "/admin/api/health", {
        origin: "https://evil.example",
      });
      expect(denied.allowOrigin).toBeNull();
      expect(denied.allowOrigin).not.toBe("*");

      const allowed = await request(port, "GET", "/admin/api/health", {
        origin: `http://${DOMAIN}`,
      });
      expect(allowed.allowOrigin).toBe(`http://${DOMAIN}`);
      expect(allowed.allowCredentials).toBe("true");

      const login = await request(port, "POST", "/admin/api/auth/login", {
        origin: "https://evil.example",
        body: { email: "root@example.com", password: "super-secret-12" },
      });
      expect(login.status).toBe(403);
    } finally {
      server.close();
    }
  });

  it("sets host-only HttpOnly session cookies and rotates the token on login", async () => {
    await createStaff({
      email: "root@example.com",
      name: "Root",
      role: "super_admin",
      password: "super-secret-12",
    });
    const { server, port } = await startServer();
    try {
      const first = await request(port, "POST", "/admin/api/auth/login", {
        cookie: "openclaw_admin_session=attacker-fixed-token",
        body: { email: "root@example.com", password: "super-secret-12" },
      });
      expect(first.status).toBe(200);
      const cookie = first.setCookie ?? "";
      expect(cookie).toContain("HttpOnly");
      expect(cookie.toLowerCase()).toContain("samesite=lax");
      expect(cookie).not.toMatch(/domain=/i);
      expect(cookie).not.toContain("attacker-fixed-token");

      const stale = await request(port, "GET", "/admin/api/auth/session", {
        cookie: "openclaw_admin_session=attacker-fixed-token",
      });
      expect(stale.status).toBe(401);

      const session = await request(port, "GET", "/admin/api/auth/session", {
        cookie: cookieFrom(first.setCookie),
      });
      expect(session.status).toBe(200);
    } finally {
      server.close();
    }
  });

  it("requires CSRF on POST, PATCH, and DELETE mutations", async () => {
    await createStaff({
      email: "root@example.com",
      name: "Root",
      role: "super_admin",
      password: "super-secret-12",
    });
    createTenant("csrf-tenant");
    const { server, port } = await startServer();
    try {
      const login = await request(port, "POST", "/admin/api/auth/login", {
        body: { email: "root@example.com", password: "super-secret-12" },
      });
      const cookie = cookieFrom(login.setCookie);
      const csrf = String(login.data.csrfToken);

      const post = await request(port, "POST", "/admin/api/tenants", {
        cookie,
        body: { tenantId: "csrf-new" },
      });
      expect(post.status).toBe(401);

      const patch = await request(port, "PATCH", "/admin/api/tenants/csrf-tenant", {
        cookie,
        body: { disabled: true },
      });
      expect(patch.status).toBe(401);

      const del = await request(port, "DELETE", "/admin/api/tenants/csrf-tenant", { cookie });
      expect(del.status).toBe(401);

      const ok = await request(port, "PATCH", "/admin/api/tenants/csrf-tenant", {
        cookie,
        csrf,
        body: { disabled: true },
      });
      expect(ok.status).toBe(200);
    } finally {
      server.close();
    }
  });

  it("enforces moderator and admin privilege boundaries on live endpoints", async () => {
    await createStaff({
      email: "root@example.com",
      name: "Root",
      role: "super_admin",
      password: "super-secret-12",
    });
    await createStaff({
      email: "ops@example.com",
      name: "Ops",
      role: "admin",
      password: "admin-secret-12",
    });
    await createStaff({
      email: "mod@example.com",
      name: "Mod",
      role: "moderator",
      password: "moderator-pass-12",
    });
    createTenant("priv-alpha");
    createTenant("priv-beta");
    const { server, port } = await startServer();
    try {
      const modLogin = await request(port, "POST", "/admin/api/auth/login", {
        body: { email: "mod@example.com", password: "moderator-pass-12" },
      });
      const modCookie = cookieFrom(modLogin.setCookie);
      const modCsrf = String(modLogin.data.csrfToken);

      expect(
        (
          await request(port, "POST", "/admin/api/staff", {
            cookie: modCookie,
            csrf: modCsrf,
            body: {
              email: "new@example.com",
              name: "N",
              role: "admin",
              password: "another-pass-12",
            },
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(port, "DELETE", "/admin/api/tenants/priv-alpha", {
            cookie: modCookie,
            csrf: modCsrf,
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(port, "PATCH", "/admin/api/quotas/priv-alpha", {
            cookie: modCookie,
            csrf: modCsrf,
            body: { tokensPerMonth: 1 },
          })
        ).status,
      ).toBe(403);

      const adminLogin = await request(port, "POST", "/admin/api/auth/login", {
        body: { email: "ops@example.com", password: "admin-secret-12" },
      });
      const adminCookie = cookieFrom(adminLogin.setCookie);
      const adminCsrf = String(adminLogin.data.csrfToken);
      expect(
        (
          await request(port, "POST", "/admin/api/staff", {
            cookie: adminCookie,
            csrf: adminCsrf,
            body: {
              email: "root2@example.com",
              name: "R2",
              role: "super_admin",
              password: "super-secret-12",
            },
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(port, "PATCH", "/admin/api/system", {
            cookie: adminCookie,
            csrf: adminCsrf,
            body: {},
          })
        ).status,
      ).toBe(403);

      const rootLogin = await request(port, "POST", "/admin/api/auth/login", {
        body: { email: "root@example.com", password: "super-secret-12" },
      });
      const rootCookie = cookieFrom(rootLogin.setCookie);
      const rootCsrf = String(rootLogin.data.csrfToken);
      const systemWrite = await request(port, "PATCH", "/admin/api/system", {
        cookie: rootCookie,
        csrf: rootCsrf,
        body: {},
      });
      expect(systemWrite.status).toBe(405);

      const missing = await request(port, "GET", "/admin/api/tenants/does-not-exist", {
        cookie: rootCookie,
      });
      expect(missing.status).toBe(404);

      const listed = await request(port, "GET", "/admin/api/tenants", { cookie: rootCookie });
      const ids = (listed.data.tenants as { tenantId: string }[]).map((row) => row.tenantId);
      expect(ids).toEqual(expect.arrayContaining(["priv-alpha", "priv-beta"]));
    } finally {
      server.close();
    }
  });

  it("rejects tenant tokens and records login failures without secrets", async () => {
    await createStaff({
      email: "root@example.com",
      name: "Root",
      role: "super_admin",
      password: "super-secret-12",
    });
    const { token } = createTenant("gamma");
    const { server, port } = await startServer();
    try {
      const tenantAuth = await request(port, "GET", "/admin/api/tenants", {
        authorization: `Bearer ${token}`,
        cookie: `openclaw_admin_session=${token}`,
      });
      expect(tenantAuth.status).toBe(401);

      await request(port, "POST", "/admin/api/auth/login", {
        body: { email: "root@example.com", password: "wrong-password-12" },
      });
      const login = await request(port, "POST", "/admin/api/auth/login", {
        body: { email: "root@example.com", password: "super-secret-12" },
      });
      const audit = await request(port, "GET", "/admin/api/audit", {
        cookie: cookieFrom(login.setCookie),
        csrf: String(login.data.csrfToken),
      });
      const events = audit.data.events as { action: string; result: string; role: string }[];
      expect(
        events.some((event) => event.action === "auth.login" && event.result === "denied"),
      ).toBe(true);
      expect(events.some((event) => event.action === "auth.login" && event.result === "ok")).toBe(
        true,
      );
      expect(JSON.stringify(events)).not.toContain("super-secret-12");
      expect(JSON.stringify(events)).not.toContain("wrong-password-12");
      expect(JSON.stringify(events)).not.toContain(token);
    } finally {
      server.close();
    }
  });

  it("bootstraps a Super Admin once and never overwrites existing staff", async () => {
    process.env.OPENCLAW_ADMIN_BOOTSTRAP_EMAIL = "first@example.com";
    process.env.OPENCLAW_ADMIN_BOOTSTRAP_PASSWORD = "bootstrap-pass-12";
    const { server, port } = await startServer();
    try {
      await request(port, "GET", "/admin/api/tenants");
      expect(getStaffByEmail("first@example.com")?.role).toBe("super_admin");

      process.env.OPENCLAW_ADMIN_BOOTSTRAP_EMAIL = "second@example.com";
      process.env.OPENCLAW_ADMIN_BOOTSTRAP_PASSWORD = "other-bootstrap-12";
      await request(port, "GET", "/admin/api/tenants");
      expect(getStaffByEmail("second@example.com")).toBeNull();
      expect(staffCount()).toBe(1);
    } finally {
      server.close();
    }
  });

  it("terminates sessions from existing tenant session stores", async () => {
    await createStaff({
      email: "root@example.com",
      name: "Root",
      role: "super_admin",
      password: "super-secret-12",
    });
    createTenant("sessy");
    const storeDir = path.join(
      process.env.OPENCLAW_STATE_DIR!,
      "tenants",
      "sessy",
      "agents",
      "main",
      "sessions",
    );
    mkdirSync(storeDir, { recursive: true });
    writeFileSync(
      path.join(storeDir, "sessions.json"),
      JSON.stringify({
        "tenant:sessy:agent:main:chat": {
          updatedAt: Date.now(),
          totalTokens: 9,
        },
      }),
    );
    const { server, port } = await startServer();
    try {
      const login = await request(port, "POST", "/admin/api/auth/login", {
        body: { email: "root@example.com", password: "super-secret-12" },
      });
      const cookie = cookieFrom(login.setCookie);
      const csrf = String(login.data.csrfToken);
      const listed = await request(port, "GET", "/admin/api/sessions", { cookie });
      expect(
        (listed.data.sessions as { key: string }[]).some(
          (row) => row.key === "tenant:sessy:agent:main:chat",
        ),
      ).toBe(true);
      const ended = await request(
        port,
        "DELETE",
        "/admin/api/sessions/tenant%3Asessy%3Aagent%3Amain%3Achat",
        {
          cookie,
          csrf,
        },
      );
      expect(ended.status).toBe(200);
      expect(ended.data.deleted).toBe(true);
    } finally {
      server.close();
    }
  });
});
