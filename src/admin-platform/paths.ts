/**
 * OPENCLAWMU ADDITION: Admin Platform state paths.
 */

import path from "node:path";
import { resolveStateDir } from "../config/paths.js";

export function resolveAdminDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), "admin");
}

export function resolveAdminStaffPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveAdminDir(env), "staff.json");
}

export function resolveAdminSessionsPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveAdminDir(env), "sessions.json");
}

export function resolveAdminAuditPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveAdminDir(env), "audit.jsonl");
}
