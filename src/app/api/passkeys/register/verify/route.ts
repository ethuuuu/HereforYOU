import { verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { getVerifiedUser } from "@/lib/auth/session";
import { consumeChallenge, CredentialSchema, deviceNameFrom, PASSKEY_FAILED, relyingParty } from "@/lib/auth/webauthn";
import { adminAuth } from "@/lib/firebase/admin";
import { savePasskey } from "@/lib/data/passkeys";
import { handle, HttpError, json, readJson } from "@/lib/http";

/**
 * Finishes creating a passkey. New accounts get a Firebase custom token for the
 * browser to sign in with; existing accounts just get the passkey added.
 */
export function POST(req: Request) {
  return handle(async () => {
    const response = (await readJson(req, CredentialSchema)) as unknown as RegistrationResponseJSON;
    const challenge = await consumeChallenge("register");
    // Adding to an account needs the same person still signed in (and not revoked).
    if (!challenge.newUser && (await getVerifiedUser())?.uid !== challenge.uid) throw new HttpError(401, PASSKEY_FAILED);

    const { rpID, origin } = relyingParty();
    const result = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    }).catch((err: unknown) => {
      console.warn("[passkeys] registration rejected", err instanceof Error ? err.name : "unknown");
      return null;
    });
    if (!result?.verified) throw new HttpError(400, PASSKEY_FAILED);

    const uid = challenge.uid!;
    if (challenge.newUser) await adminAuth().createUser({ uid, displayName: challenge.newUser.displayName });
    const { credential } = result.registrationInfo;
    await savePasskey({
      id: credential.id,
      uid,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports ?? [],
      deviceName: deviceNameFrom(req.headers.get("user-agent")),
    });
    return json(challenge.newUser ? { customToken: await adminAuth().createCustomToken(uid) } : { ok: true });
  });
}
