import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleAdminPlatformHttpRequest } from "./http.js";
import { createStaff, staffCount } from "./staff-store.js";
import { hasPermission, canAssignRole, canManageStaffRecord } from "./permissions.js";
import { hashPassword, verifyPassword } from "./password.js";
import { createTenant } from "../tenants/index.js";
import { clearConfigCache } from "../config/config.js";

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
  opts: { body?: unknown; cookie?: string; csrf?: string; host?: string } = {},
) {
  const headers: Record<string, string> = {
    Host: opts.host ?? DOMAIN,
    Origin: `http://${DOMAIN}`,
  };
  if (opts.cookie) {
    headers.cookie = opts.cookie;
  }
  if (opts.csrf) {
    headers["X-Admin-CSRF"] = opts.csrf;
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
  return { status: res.status, data, setCookie: res.headers.get("set-cookie") };
}

function cookieFrom(setCookie: string | null): string {
  return setCookie?.split(";")[0] ?? "";
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
    expect(hasPermission("super_admin", "admins.manage")).toBe(true);
    const admin = {
      id: "a",
      email: "a@x.com",
      name: "A",
      role: "admin" as const,
      disabled: false,
      createdAt: "",
      updatedAt: "",
      totpEnabled: false,
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
      expect((listed.data.tenants as { tenantId: string }[]).some((row) => row.tenantId === "acme")).toBe(
        true,
      );
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
      void handleAdminPlatformHttpRequest(req, res, { dedicatedListener: false }).then((handled) => {
        if (!handled) {
          res.statusCode = 204;
          res.end();
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("no port");
    }
    try {
      const res = await request(address.port, "GET", "/admin/api/health", { host: "app.test.local" });
      expect(res.status).toBe(204);
    } finally {
      server.close();
    }
  });
});
