/**
 * OPENCLAWMU ADDITION: static Admin UI (separate from Control UI).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_CANDIDATES = [
  path.resolve(here, "../../dist/admin-ui"),
  path.resolve(here, "public"),
  path.resolve(here, "../../src/admin-platform/public"),
];

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function resolveRoot(): string {
  for (const candidate of PUBLIC_CANDIDATES) {
    if (fs.existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }
  return PUBLIC_CANDIDATES[1] ?? path.resolve(here, "public");
}

export function serveAdminUi(req: IncomingMessage, res: ServerResponse): void {
  const root = resolveRoot();
  const url = new URL(req.url ?? "/", "http://localhost");
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/" || rel === "") {
    rel = "/index.html";
  }
  const unsafe = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "");
  const candidate = path.join(root, unsafe);
  const filePath =
    fs.existsSync(candidate) && fs.statSync(candidate).isFile()
      ? candidate
      : path.join(root, "index.html");
  const ext = path.extname(filePath);
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'");
  res.end(fs.readFileSync(filePath));
}
