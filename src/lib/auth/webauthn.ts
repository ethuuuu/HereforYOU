/**
 * Shared bits of the passkey (WebAuthn) routes: relying-party config, the
 * challenge cookie and the credential body schema. See AGENTS.md §8.
 */
import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { CHALLENGE_TTL_MS, takeChallenge, type ChallengePurpose } from "@/lib/data/webauthnChallenges";

const CHALLENGE_COOKIE = "hfy_wa";
export const PASSKEY_FAILED = "That passkey didn't work. Try again or use Google.";

export function relyingParty() {
  const env = serverEnv();
  return { rpID: env.WEBAUTHN_RP_ID, rpName: env.WEBAUTHN_RP_NAME, origin: env.APP_URL };
}

export async function setChallengeCookie(id: string): Promise<void> {
  (await cookies()).set(CHALLENGE_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/passkeys",
    maxAge: CHALLENGE_TTL_MS / 1000,
  });
}

/** The challenge this browser was given (one-time; cookie cleared). Throws 400 if none is valid. */
export async function consumeChallenge(purpose: ChallengePurpose) {
  const jar = await cookies();
  const id = jar.get(CHALLENGE_COOKIE)?.value;
  jar.delete({ name: CHALLENGE_COOKIE, path: "/api/passkeys" });
  const challenge = id && /^[A-Za-z0-9]{1,64}$/.test(id) ? await takeChallenge(id, purpose) : null;
  if (!challenge) throw new HttpError(400, "That took too long. Please try again.");
  return challenge;
}

const b64url = z.string().min(1).max(16_384).regex(/^[A-Za-z0-9_-]+$/);
/** Outer shape of a browser credential; @simplewebauthn checks the cryptographic details. */
export const CredentialSchema = z.looseObject({
  id: b64url.max(1400),
  rawId: b64url.max(1400),
  type: z.literal("public-key"),
  response: z.looseObject({ clientDataJSON: b64url }),
  clientExtensionResults: z.record(z.string(), z.unknown()).default({}),
});

/** A friendly name for the settings list, e.g. "iPhone". Never stores the raw user agent. */
export function deviceNameFrom(userAgent: string | null): string {
  const ua = userAgent ?? "";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android phone";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows computer";
  if (/CrOS/.test(ua)) return "Chromebook";
  return "This device";
}
