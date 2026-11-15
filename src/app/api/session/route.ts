import { cookies } from "next/headers";
import { z } from "zod";
import { clearSession, createSession } from "@/lib/auth/session";
import { ensureUser, pathForProfile } from "@/lib/data/users";
import { handle, HttpError, json, readJson } from "@/lib/http";
import { parsePrefs, PREFS_COOKIE } from "@/lib/prefs";

const SignInSchema = z.object({ idToken: z.string().min(1).max(8192) });

/** Exchange a fresh Firebase ID token for the httpOnly session cookie. */
export function POST(req: Request) {
  return handle(async () => {
    const { idToken } = await readJson(req, SignInSchema);
    const user = await createSession(idToken).catch((err: unknown) => {
      console.warn("[session] sign-in rejected", err instanceof Error ? err.name : "unknown");
      throw new HttpError(401, "We couldn't sign you in. Please try again.");
    });
    const prefs = parsePrefs((await cookies()).get(PREFS_COOKIE)?.value);
    const profile = await ensureUser(user, prefs);
    return json({ next: pathForProfile(profile) });
  });
}

/** Sign out: clears the session cookie. */
export function DELETE() {
  return handle(async () => {
    await clearSession();
    return json({ ok: true });
  });
}
