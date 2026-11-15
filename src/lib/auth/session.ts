/**
 * Sessions = Firebase session cookies (httpOnly, secure, sameSite=lax).
 * Flow: client signs in (Google or passkey→custom token) → sends ID token to
 * POST /api/session → server calls createSession → cookie set.
 */
import "server-only";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";

export const SESSION_COOKIE = "hfy_session";
const SESSION_DAYS = 5;

export async function createSession(idToken: string): Promise<void> {
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
}

export type SessionUser = { uid: string; email?: string; name?: string };

/** Returns the signed-in user, or null. Checks revocation. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
    return { uid: decoded.uid, email: decoded.email, name: decoded.name as string | undefined };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
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
