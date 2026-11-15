import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/firebase/admin";
import { HttpError } from "@/lib/http";

/**
 * Fixed-window rate limit stored in Firestore (no extra service): 1 read + 1 write per call.
 * Keys are hashed so IPs/uids aren't stored readable. Enable a Firestore TTL policy on
 * `rateLimits.expiresAt` to clean up old windows automatically.
 */
export async function consumeRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const window = Math.floor(Date.now() / windowMs);
  const id = createHash("sha256").update(`${key}:${window}`).digest("hex").slice(0, 40);
  const ref = db().collection("rateLimits").doc(id);
  return db().runTransaction(async (tx) => {
    const count = ((await tx.get(ref)).data()?.count as number | undefined) ?? 0;
    if (count >= limit) return false;
    tx.set(ref, { count: count + 1, expiresAt: new Date((window + 2) * windowMs) });
    return true;
  });
}

const HOUR = 60 * 60 * 1000;

/** Throws 429 with a plain message once `key` has used up `perHour` calls this hour. */
export async function enforceRateLimit(key: string, perHour: number): Promise<void> {
  if (!(await consumeRateLimit(key, perHour, HOUR))) {
    throw new HttpError(429, "You've done that a lot just now. Please wait a little while and try again.");
  }
}

/** Best-effort client IP behind Vercel's proxy (for limiting anonymous requests). */
export function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
