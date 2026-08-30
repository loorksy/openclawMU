/**
 * OPENCLAWMU ADDITION: Admin Platform HTTP helpers.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { AdminPlatformRuntimeConfig } from "./config.js";
import { loadConfig } from "../config/config.js";
import { sendJson } from "../gateway/http-common.js";
import { getHeader } from "../gateway/http-utils.js";
import { resolveGatewayClientIp } from "../gateway/net.js";
import { isAllowedOrigin } from "./config.js";

export function applyAdminSecurityHeaders(
  req: IncomingMessage,
  res: ServerResponse,
  config: AdminPlatformRuntimeConfig,
): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  const origin = getHeader(req, "origin");
  if (origin && isAllowedOrigin(origin, config)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-CSRF");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  }
}

export function clientIp(req: IncomingMessage): string | undefined {
  const config = loadConfig();
  return resolveGatewayClientIp({
    remoteAddr: req.socket.remoteAddress,
    forwardedFor: getHeader(req, "x-forwarded-for"),
    realIp: getHeader(req, "x-real-ip"),
    trustedProxies: config.gateway?.trustedProxies ?? [],
  });
}

export function sendAdminError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

export async function readAdminJson(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > 65_536) {
      sendAdminError(res, 413, "Request body too large");
      return null;
    }
    chunks.push(buf);
  }
  if (chunks.length === 0) {
    return {};
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      sendAdminError(res, 400, "JSON object required");
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    sendAdminError(res, 400, "Invalid JSON");
    return null;
  }
}

export function queryParams(url: URL): URLSearchParams {
  return url.searchParams;
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
