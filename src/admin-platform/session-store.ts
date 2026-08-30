/**
 * OPENCLAWMU ADDITION: hashed admin sessions + CSRF tokens.
 */

import { createHmac, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AdminSessionRecord, AdminSessionStoreFile } from "./types.js";
import { resolveAdminSessionsPath } from "./paths.js";

const COOKIE_NAME = "openclaw_admin_session";

export function adminSessionCookieName(): string {
  return COOKIE_NAME;
}

function hashToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function loadSessionStore(env: NodeJS.ProcessEnv = process.env): AdminSessionStoreFile {
  const filePath = resolveAdminSessionsPath(env);
  try {
    if (!fs.existsSync(filePath)) {
      return { version: 1, sessions: {} };
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as AdminSessionStoreFile;
    if (parsed?.version !== 1 || typeof parsed.sessions !== "object" || !parsed.sessions) {
      return { version: 1, sessions: {} };
    }
    return parsed;
  } catch {
    return { version: 1, sessions: {} };
  }
}

export function saveSessionStore(
  store: AdminSessionStoreFile,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const filePath = resolveAdminSessionsPath(env);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // best-effort
  }
}

function pruneExpired(store: AdminSessionStoreFile): boolean {
  const now = Date.now();
  let changed = false;
  for (const [id, session] of Object.entries(store.sessions)) {
    if (Date.parse(session.expiresAt) <= now) {
      delete store.sessions[id];
      changed = true;
    }
  }
  return changed;
}

export function createAdminSession(
  staffId: string,
  ttlSeconds: number,
  sessionSecret: string | null,
  meta: { ip?: string; userAgent?: string },
  env: NodeJS.ProcessEnv = process.env,
): { token: string; session: AdminSessionRecord } {
  if (!sessionSecret) {
    throw new Error("Admin session secret is required");
  }
  const store = loadSessionStore(env);
  pruneExpired(store);
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const session: AdminSessionRecord = {
    id: randomUUID(),
    staffId,
    tokenHash: hashToken(token, sessionSecret),
    csrfToken: randomBytes(24).toString("base64url"),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlSeconds * 1000).toISOString(),
    ip: meta.ip,
    userAgent: meta.userAgent,
  };
  store.sessions[session.id] = session;
  saveSessionStore(store, env);
  return { token, session };
}

export function findAdminSession(
  token: string | undefined,
  sessionSecret: string | null,
  env: NodeJS.ProcessEnv = process.env,
): AdminSessionRecord | null {
  if (!token || !sessionSecret) {
    return null;
  }
  const tokenHash = hashToken(token, sessionSecret);
  const store = loadSessionStore(env);
  const changed = pruneExpired(store);
  const match = Object.values(store.sessions).find((session) => session.tokenHash === tokenHash);
  if (changed) {
    saveSessionStore(store, env);
  }
  if (!match) {
    return null;
  }
  if (Date.parse(match.expiresAt) <= Date.now()) {
    return null;
  }
  return match;
}

export function revokeAdminSession(sessionId: string, env: NodeJS.ProcessEnv = process.env): void {
  const store = loadSessionStore(env);
  delete store.sessions[sessionId];
  saveSessionStore(store, env);
}

export function revokeStaffSessions(staffId: string, env: NodeJS.ProcessEnv = process.env): number {
  const store = loadSessionStore(env);
  let revoked = 0;
  for (const [id, session] of Object.entries(store.sessions)) {
    if (session.staffId === staffId) {
      delete store.sessions[id];
      revoked += 1;
    }
  }
  saveSessionStore(store, env);
  return revoked;
}

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) {
    return out;
  }
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  }
  return out;
}

export function readSessionToken(cookieHeader: string | undefined): string | undefined {
  return parseCookieHeader(cookieHeader)[COOKIE_NAME];
}

export function buildSessionCookie(
  token: string,
  opts: {
    ttlSeconds: number;
    secure: boolean;
    sameSite: "strict" | "lax" | "none";
    clear?: boolean;
  },
): string {
  const parts = [
    `${COOKIE_NAME}=${opts.clear ? "" : encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${opts.sameSite}`,
    `Max-Age=${opts.clear ? 0 : opts.ttlSeconds}`,
  ];
  if (opts.secure || opts.sameSite === "none") {
    parts.push("Secure");
  }
  return parts.join("; ");
}
