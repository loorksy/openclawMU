/**
 * OPENCLAWMU ADDITION: Admin views over existing tenant/usage/session stores.
 */

import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../config/config.js";
import {
  loadSessionStore,
  resolveDefaultSessionStorePath,
  resolveStorePath,
  updateSessionStore,
} from "../config/sessions.js";
import { collectSystemMetrics } from "../infra/system-metrics.js";
import { extractTenantIdFromSessionKey } from "../routing/session-key.js";
import {
  createTenant,
  getTenant,
  isValidTenantId,
  listTenants,
  loadTenantUsage,
  loadTenantUsageHistory,
  getTenantQuotaStatus,
  removeTenant,
  resolveTenantConfigPath,
  resolveTenantSessionsDir,
  resolveTenantStateDir,
  rotateTenantToken,
  updateTenant,
  type TenantQuotas,
} from "../tenants/index.js";
import { AdminNotFoundError, AdminValidationError } from "./permissions.js";

export type AdminSessionRow = {
  key: string;
  tenantId: string | null;
  agentId?: string;
  updatedAt?: number;
  created?: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  chatType?: string;
};

function redactConfig(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactConfig);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (/(token|secret|password|authorization|apiKey|privateKey)/i.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] = redactConfig(nested);
  }
  return out;
}

export function requireExistingTenant(tenantId: string) {
  if (!isValidTenantId(tenantId)) {
    throw new AdminValidationError("Invalid tenant ID");
  }
  const tenant = getTenant(tenantId);
  if (!tenant) {
    throw new AdminNotFoundError("Tenant not found");
  }
  return tenant;
}

export async function buildTenantList() {
  const ids = listTenants();
  const rows = [];
  for (const tenantId of ids) {
    const tenant = getTenant(tenantId);
    const usage = await loadTenantUsage(tenantId);
    const quota = await getTenantQuotaStatus(tenantId, tenant?.quotas ?? {});
    rows.push({
      tenantId,
      displayName: tenant?.displayName ?? tenantId,
      status: tenant?.disabled ? "suspended" : "active",
      createdAt: tenant?.createdAt,
      lastActivity: tenant?.lastSeenAt ?? null,
      usage,
      quota: {
        tokenUsagePercent: quota.tokenUsagePercent,
        costUsagePercent: quota.costUsagePercent,
        diskUsagePercent: quota.diskUsagePercent,
        isBlocked: quota.isBlocked,
        isOverQuota: quota.isOverTokenLimit || quota.isOverCostLimit || quota.isOverDiskLimit,
      },
    });
  }
  return rows;
}

export async function buildTenantDetail(tenantId: string) {
  const tenant = requireExistingTenant(tenantId);
  const usage = await loadTenantUsage(tenantId);
  const history = await loadTenantUsageHistory(tenantId, 6);
  const quota = await getTenantQuotaStatus(tenantId, tenant.quotas ?? {});
  const overlayPath = resolveTenantConfigPath(tenantId);
  let overlay: unknown = null;
  if (fs.existsSync(overlayPath)) {
    try {
      overlay = redactConfig(JSON.parse(fs.readFileSync(overlayPath, "utf8")));
    } catch {
      overlay = null;
    }
  }
  const agents = Array.isArray((overlay as { agents?: { list?: unknown } } | null)?.agents?.list)
    ? (overlay as { agents: { list: unknown[] } }).agents.list
    : [];
  const channels = (overlay as { channels?: unknown } | null)?.channels ?? {};
  return {
    tenantId,
    displayName: tenant.displayName ?? tenantId,
    status: tenant.disabled ? "suspended" : "active",
    createdAt: tenant.createdAt,
    lastActivity: tenant.lastSeenAt ?? null,
    stateDir: resolveTenantStateDir(tenantId),
    quotas: tenant.quotas ?? {},
    usage,
    history,
    quota,
    agents,
    channels,
    configuration: overlay,
    sessions: listTenantSessions(tenantId),
  };
}

function configuredAgentIds(): string[] {
  const cfg = loadConfig();
  const ids = (cfg.agents?.list ?? [])
    .map((agent) => agent.id)
    .filter((id): id is string => Boolean(id));
  return ids.length > 0 ? ids : ["main"];
}

function scanAgentSessionFiles(root: string, into: Set<string>): void {
  const agentsDir = path.join(root, "agents");
  if (!fs.existsSync(agentsDir)) {
    return;
  }
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(agentsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const storePath = path.join(agentsDir, entry.name, "sessions", "sessions.json");
    if (fs.existsSync(storePath)) {
      into.add(path.resolve(storePath));
    }
  }
}

export function collectSessionStorePaths(): string[] {
  const found = new Set<string>();
  const cfg = loadConfig();
  const storeSetting = typeof cfg.session?.store === "string" ? cfg.session.store : undefined;
  const addIfExists = (storePath: string) => {
    if (storePath && fs.existsSync(storePath) && fs.statSync(storePath).isFile()) {
      found.add(path.resolve(storePath));
    }
  };

  for (const agentId of configuredAgentIds()) {
    addIfExists(resolveStorePath(storeSetting, { agentId }));
    addIfExists(resolveDefaultSessionStorePath(agentId));
  }

  scanAgentSessionFiles(resolveTenantStateDir(undefined), found);
  for (const tenantId of listTenants()) {
    scanAgentSessionFiles(resolveTenantStateDir(tenantId), found);
    for (const agentId of configuredAgentIds()) {
      addIfExists(path.join(resolveTenantSessionsDir(tenantId, agentId), "sessions.json"));
    }
  }
  return [...found];
}

function agentIdFromStorePath(storePath: string): string | undefined {
  const match = storePath
    .replaceAll("\\", "/")
    .match(/\/agents\/([^/]+)\/sessions\/sessions\.json$/);
  return match?.[1];
}

export function listTenantSessions(tenantId?: string): AdminSessionRow[] {
  const rows: AdminSessionRow[] = [];
  const seen = new Set<string>();
  for (const storePath of collectSessionStorePaths()) {
    const store = loadSessionStore(storePath);
    const agentId = agentIdFromStorePath(storePath);
    for (const [key, entry] of Object.entries(store)) {
      if (seen.has(key)) {
        continue;
      }
      const keyTenant = extractTenantIdFromSessionKey(key) ?? null;
      if (tenantId && keyTenant !== tenantId) {
        continue;
      }
      seen.add(key);
      rows.push({
        key,
        tenantId: keyTenant,
        agentId,
        updatedAt: entry.updatedAt,
        totalTokens: entry.totalTokens,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        chatType: entry.chatType,
      });
    }
  }
  return rows.toSorted((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export async function terminateTenantSession(key: string): Promise<boolean> {
  for (const storePath of collectSessionStorePaths()) {
    let deleted = false;
    await updateSessionStore(storePath, (store) => {
      if (store[key]) {
        delete store[key];
        deleted = true;
      }
    });
    if (deleted) {
      return true;
    }
  }
  return false;
}

export async function createAdminTenant(tenantId: string, displayName?: string) {
  if (!isValidTenantId(tenantId)) {
    throw new AdminValidationError("Invalid tenant ID format");
  }
  return createTenant(tenantId, { displayName });
}

export function updateAdminTenant(
  tenantId: string,
  updates: { displayName?: string; disabled?: boolean; quotas?: TenantQuotas },
) {
  requireExistingTenant(tenantId);
  updateTenant(tenantId, updates);
  return getTenant(tenantId);
}

export function deleteAdminTenant(tenantId: string, deleteData: boolean) {
  requireExistingTenant(tenantId);
  removeTenant(tenantId, { deleteData });
}

export function rotateAdminTenantToken(tenantId: string) {
  requireExistingTenant(tenantId);
  return rotateTenantToken(tenantId);
}

export async function buildDashboard() {
  const tenants = await buildTenantList();
  const system = await collectSystemMetrics({ includeTenantsAggregate: true });
  const active = tenants.filter((row) => row.status === "active").length;
  const suspended = tenants.filter((row) => row.status === "suspended").length;
  const sessions = listTenantSessions();
  const tokenUsage = tenants.reduce((sum, row) => sum + (row.usage.totalTokens ?? 0), 0);
  const costCents = tenants.reduce((sum, row) => sum + (row.usage.totalCostCents ?? 0), 0);
  const requests = tenants.reduce((sum, row) => sum + (row.usage.totalRequests ?? 0), 0);
  return {
    totals: {
      tenants: tenants.length,
      activeTenants: active,
      suspendedTenants: suspended,
      activeUsers: active,
      activeSessions: sessions.filter((row) => (row.updatedAt ?? 0) > Date.now() - 3_600_000)
        .length,
      requests,
      tokenUsage,
      estimatedCostCents: costCents,
    },
    system: {
      status: "ok",
      cpu: system.cpu,
      memory: system.memory,
      disk: system.disk,
      uptimeSeconds: system.uptimeSeconds,
      process: system.process,
      activeConnections: system.activeConnections,
    },
    tenants: tenants.slice(0, 12),
  };
}

export async function buildUsageSummary(range: "today" | "7d" | "30d" | "custom") {
  const tenants = listTenants();
  const months = range === "30d" || range === "custom" ? 2 : 1;
  const byTenant = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let costCents = 0;
  let requests = 0;
  for (const tenantId of tenants) {
    const current = await loadTenantUsage(tenantId);
    const history = await loadTenantUsageHistory(tenantId, months);
    inputTokens += current.inputTokens;
    outputTokens += current.outputTokens;
    totalTokens += current.totalTokens;
    costCents += current.totalCostCents;
    requests += current.totalRequests;
    byTenant.push({
      tenantId,
      inputTokens: current.inputTokens,
      outputTokens: current.outputTokens,
      totalTokens: current.totalTokens,
      costCents: current.totalCostCents,
      requests: current.totalRequests,
      history,
    });
  }
  return {
    range,
    totals: { requests, inputTokens, outputTokens, totalTokens, estimatedCostCents: costCents },
    byTenant,
  };
}
