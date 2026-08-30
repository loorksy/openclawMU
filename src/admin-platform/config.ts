/**
 * OPENCLAWMU ADDITION: Admin Platform runtime configuration.
 */

import { loadConfig } from "../config/config.js";

export type AdminSameSite = "strict" | "lax" | "none";

export type AdminPlatformRuntimeConfig = {
  enabled: boolean;
  domain: string | null;
  port: number | null;
  sessionSecret: string | null;
  sessionTtlSeconds: number;
  cookieSecure: boolean;
  cookieSameSite: AdminSameSite;
  allowedOrigins: string[];
  bootstrapEmail: string | null;
  bootstrapPassword: string | null;
};

function readEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseSameSite(value: string | undefined, fallback: AdminSameSite): AdminSameSite {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "strict" || normalized === "lax" || normalized === "none") {
    return normalized;
  }
  return fallback;
}

function uniqueOrigins(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function resolveAdminPlatformConfig(
  env: NodeJS.ProcessEnv = process.env,
): AdminPlatformRuntimeConfig {
  const cfg = loadConfig();
  const file = cfg.gateway?.adminPlatform;
  const domain = readEnv(env, "OPENCLAW_ADMIN_DOMAIN") ?? file?.domain ?? null;
  const portRaw = readEnv(env, "OPENCLAW_ADMIN_PORT") ?? (file?.port != null ? String(file.port) : undefined);
  const port = portRaw ? Number(portRaw) : null;
  const sessionSecret =
    readEnv(env, "OPENCLAW_ADMIN_SESSION_SECRET") ?? file?.sessionSecret ?? null;
  const sessionTtlSeconds = Number(
    readEnv(env, "OPENCLAW_ADMIN_SESSION_TTL") ?? file?.sessionTtlSeconds ?? 43_200,
  );
  const cookieSecure = parseBoolean(
    readEnv(env, "OPENCLAW_ADMIN_COOKIE_SECURE"),
    file?.cookieSecure ?? true,
  );
  const cookieSameSite = parseSameSite(
    readEnv(env, "OPENCLAW_ADMIN_COOKIE_SAME_SITE"),
    file?.cookieSameSite ?? "strict",
  );
  const allowedOrigins = uniqueOrigins([
    ...(file?.allowedOrigins ?? []),
    ...(readEnv(env, "OPENCLAW_ADMIN_ALLOWED_ORIGINS")?.split(",") ?? []),
    domain ? `https://${domain}` : "",
    domain ? `http://${domain}` : "",
  ]);
  const enabled =
    file?.enabled ??
    Boolean(sessionSecret || domain || (port && Number.isFinite(port)));

  return {
    enabled,
    domain: domain?.toLowerCase() ?? null,
    port: port && Number.isFinite(port) ? port : null,
    sessionSecret,
    sessionTtlSeconds: Number.isFinite(sessionTtlSeconds) && sessionTtlSeconds > 60 ? sessionTtlSeconds : 43_200,
    cookieSecure,
    cookieSameSite,
    allowedOrigins,
    bootstrapEmail: readEnv(env, "OPENCLAW_ADMIN_BOOTSTRAP_EMAIL")?.toLowerCase() ?? null,
    bootstrapPassword: readEnv(env, "OPENCLAW_ADMIN_BOOTSTRAP_PASSWORD") ?? null,
  };
}

export function normalizeHost(hostHeader: string | undefined): string | null {
  if (!hostHeader) {
    return null;
  }
  const trimmed = hostHeader.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    return end >= 0 ? trimmed.slice(1, end) : trimmed;
  }
  return trimmed.split(":")[0] ?? trimmed;
}

export function isAdminHostRequest(
  hostHeader: string | undefined,
  config: AdminPlatformRuntimeConfig,
  dedicatedListener: boolean,
): boolean {
  if (dedicatedListener) {
    return true;
  }
  if (!config.domain) {
    return false;
  }
  return normalizeHost(hostHeader) === config.domain;
}

export function isAllowedOrigin(origin: string | undefined, config: AdminPlatformRuntimeConfig): boolean {
  if (!origin) {
    return false;
  }
  return config.allowedOrigins.includes(origin);
}
