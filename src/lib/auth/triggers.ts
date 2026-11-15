/**
 * Authorises calls to /api/reminders/run. Accepted callers:
 *  - Upstash QStash schedule (signed request, verified with signing keys)
 *  - Vercel Cron (Authorization: Bearer CRON_SECRET)
 */
import { timingSafeEqual } from "node:crypto";
import { Receiver } from "@upstash/qstash";

export type TriggerSource = "qstash" | "vercel-cron";

export function isVercelCron(authHeader: string | null, cronSecret: string | undefined): boolean {
  if (!authHeader || !cronSecret) return false;
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const actual = Buffer.from(authHeader);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function isQStash(
  signature: string | null,
  body: string,
  keys: { current?: string; next?: string },
): Promise<boolean> {
  if (!signature || !keys.current || !keys.next) return false;
  try {
    const receiver = new Receiver({ currentSigningKey: keys.current, nextSigningKey: keys.next });
    return await receiver.verify({ signature, body });
  } catch {
    return false;
  }
}

export async function authorizeTrigger(req: Request, body: string): Promise<TriggerSource | null> {
  if (isVercelCron(req.headers.get("authorization"), process.env.CRON_SECRET)) return "vercel-cron";
  const ok = await isQStash(req.headers.get("upstash-signature"), body, {
    current: process.env.QSTASH_CURRENT_SIGNING_KEY,
    next: process.env.QSTASH_NEXT_SIGNING_KEY,
  });
  return ok ? "qstash" : null;
}
