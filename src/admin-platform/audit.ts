/**
 * OPENCLAWMU ADDITION: append-only admin audit log.
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveAdminAuditPath } from "./paths.js";
import type { AdminAuditEvent, AdminAuthContext } from "./types.js";

const SENSITIVE_KEY = /(password|secret|token|authorization|cookie|api[_-]?key)/i;

function sanitizeMetadata(
  metadata?: Record<string, unknown>,
): Record<string, string | number | boolean | null> | undefined {
  if (!metadata) {
    return undefined;
  }
  const clean: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEY.test(key)) {
      continue;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      clean[key] = value;
    } else if (value === null) {
      clean[key] = null;
    }
  }
  return clean;
}

export function appendAuditEvent(
  event: Omit<AdminAuditEvent, "id" | "ts">,
  env: NodeJS.ProcessEnv = process.env,
): AdminAuditEvent {
  const full: AdminAuditEvent = {
    ...event,
    id: randomUUID(),
    ts: new Date().toISOString(),
    metadata: sanitizeMetadata(event.metadata),
  };
  const filePath = resolveAdminAuditPath(env);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(full)}\n`, { mode: 0o600 });
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // best-effort
  }
  return full;
}

export function auditFromContext(
  ctx: AdminAuthContext,
  action: string,
  extra: Omit<AdminAuditEvent, "id" | "ts" | "actorId" | "actorEmail" | "role" | "action">,
  env?: NodeJS.ProcessEnv,
): AdminAuditEvent {
  return appendAuditEvent(
    {
      actorId: ctx.staff.id,
      actorEmail: ctx.staff.email,
      role: ctx.staff.role,
      action,
      ...extra,
    },
    env,
  );
}

export function readAuditEvents(
  opts: { limit?: number; actorId?: string; action?: string; targetId?: string } = {},
  env: NodeJS.ProcessEnv = process.env,
): AdminAuditEvent[] {
  const filePath = resolveAdminAuditPath(env);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const events: AdminAuditEvent[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    try {
      events.push(JSON.parse(line) as AdminAuditEvent);
    } catch {
      // skip corrupt line
    }
  }
  const filtered = events.filter((event) => {
    if (opts.actorId && event.actorId !== opts.actorId) {
      return false;
    }
    if (opts.action && event.action !== opts.action) {
      return false;
    }
    if (opts.targetId && event.targetId !== opts.targetId) {
      return false;
    }
    return true;
  });
  const limit = opts.limit ?? 200;
  return filtered.slice(-limit).toReversed();
}
