/**
 * OPENCLAWMU ADDITION: scrypt password hashing for Admin Platform staff.
 */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const MIN_PASSWORD_LENGTH = 12;

function deriveKey(
  password: string,
  salt: Buffer,
  keyLen: number,
  n: number,
  r: number,
  p: number,
): Buffer {
  return scryptSync(password, salt, keyLen, { N: n, r, p });
}

export function assertPasswordPolicy(password: string): void {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordPolicy(password);
  const salt = randomBytes(16);
  const derived = deriveKey(password, salt, KEY_LEN, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }
  try {
    const salt = Buffer.from(parts[4] ?? "", "base64url");
    const expected = Buffer.from(parts[5] ?? "", "base64url");
    const derived = deriveKey(password, salt, expected.length, n, r, p);
    if (derived.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
