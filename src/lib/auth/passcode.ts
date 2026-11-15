/**
 * Care-circle passcodes. Never stored in plain text: scrypt with a per-passcode
 * random salt, compared in constant time. Format: scrypt$N$r$p$saltB64$hashB64
 */
import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 32;

function scrypt(password: string, salt: Buffer, keyLen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keyLen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPasscode(passcode: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(passcode, salt, KEY_LEN, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPasscode(passcode: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(passcode, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Lockout policy for wrong passcodes on one circle. */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export function isLockedOut(failedAttempts: number, lastFailedAt: Date | null, now: Date): boolean {
  if (failedAttempts < MAX_FAILED_ATTEMPTS || !lastFailedAt) return false;
  return now.getTime() - lastFailedAt.getTime() < LOCKOUT_MINUTES * 60_000;
}

/** Count after one more wrong try. A lockout that has run out starts a fresh count. */
export function nextFailedAttempts(failedAttempts: number): number {
  return (failedAttempts >= MAX_FAILED_ATTEMPTS ? 0 : failedAttempts) + 1;
}

/** One-time 6-digit code the elder enters to take over a circle a relative set up. */
export function generateClaimCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Short, unambiguous circle code like "HFY-7K3P9Q" (no 0/O/1/I). */
export function generateCircleCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let code = "";
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return `HFY-${code}`;
}
