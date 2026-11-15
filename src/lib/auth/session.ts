/**
 * Sessions = Firebase session cookies (httpOnly, secure, sameSite=lax).
 * Flow: client signs in (Google or passkey→custom token) → sends ID token to
 * POST /api/session → server calls createSession → cookie set.
 */
import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { adminAuth } from "@/lib/firebase/admin";

export const SESSION_COOKIE = "hfy_session";
const SESSION_DAYS = 14; // Firebase's maximum: elders shouldn't have to sign in often

/** Verifies a fresh ID token, sets the session cookie and returns who signed in. */
export async function createSession(idToken: string): Promise<SessionUser> {
  const decoded = await adminAuth().verifyIdToken(idToken, true);
  // Only accept recent sign-ins (prevents replaying an old ID token).
  if (Date.now() / 1000 - decoded.auth_time > 5 * 60) throw new Error("Sign-in too old");
  const expiresIn = SESSION_DAYS * 24 * 60 * 60 * 1000;
  const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn });
  (await cookies()).set(SESSION_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn / 1000,
  });
  return { uid: decoded.uid, email: decoded.email, name: decoded.name as string | undefined };
}

export type SessionUser = { uid: string; email?: string; name?: string };

async function readSession(checkRevoked: boolean): Promise<SessionUser | null> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, checkRevoked);
    return { uid: decoded.uid, email: decoded.email, name: decoded.name as string | undefined };
  } catch {
    return null;
  }
}

/**
 * Signed-in user for page rendering, or null. Signature + expiry are checked locally
 * (no network) and the result is shared by every component in one request.
 * Revocation needs a Firebase round trip, so it's checked on every API call (requireUser),
 * where data actually changes — this keeps page navigation fast.
 */
export const getSessionUser = cache(() => readSession(false));

/** Signed in and not revoked, or null. For mutations that may also run signed out (passkey sign-up). */
export const getVerifiedUser = () => readSession(true);

/** For route handlers: signed in AND not revoked. */
export async function requireUser(): Promise<SessionUser> {
  const user = await readSession(true);
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthorizedError";
  }
}
