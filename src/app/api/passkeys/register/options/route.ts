import { randomUUID } from "node:crypto";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { relyingParty, setChallengeCookie } from "@/lib/auth/webauthn";
import { listPasskeys } from "@/lib/data/passkeys";
import { saveChallenge } from "@/lib/data/webauthnChallenges";
import { handle, json, readJson } from "@/lib/http";

const Body = z.object({ displayName: z.string().trim().min(1, "Please enter your name.").max(80).optional() });

/**
 * Starts creating a passkey. Signed in → adds one to that account (same uid, so the
 * same profile loads next time). Signed out → a new account named `displayName`.
 */
export function POST(req: Request) {
  return handle(async () => {
    const { displayName } = await readJson(req, Body);
    const user = await getSessionUser();
    if (!user && !displayName) return json({ error: "Please enter your name.", fields: { displayName: "Please enter your name." } }, 400);

    const uid = user?.uid ?? randomUUID().replaceAll("-", ""); // Firebase user is created only after verify
    const existing = user ? await listPasskeys(uid) : [];
    const { rpID, rpName } = relyingParty();
    const options = await generateRegistrationOptions({
      rpID,
      rpName,
      userID: new TextEncoder().encode(uid),
      userName: user?.email ?? user?.name ?? displayName ?? "Here For YOU",
      userDisplayName: user?.name ?? displayName,
      attestationType: "none",
      excludeCredentials: existing.map((p) => ({ id: p.id, transports: p.transports })),
      authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    });
    const id = await saveChallenge({
      challenge: options.challenge,
      purpose: "register",
      uid,
      ...(user ? {} : { newUser: { displayName: displayName! } }),
    });
    await setChallengeCookie(id);
    return json(options);
  });
}
