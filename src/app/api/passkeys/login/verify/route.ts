import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { consumeChallenge, CredentialSchema, PASSKEY_FAILED, relyingParty } from "@/lib/auth/webauthn";
import { adminAuth } from "@/lib/firebase/admin";
import { getPasskey, recordPasskeyUse } from "@/lib/data/passkeys";
import { handle, HttpError, json, readJson } from "@/lib/http";

/**
 * Finishes a passkey sign-in → Firebase custom token for the passkey's owner. The
 * browser signs in with it and posts the ID token to /api/session, which loads
 * that person's existing profile.
 */
export function POST(req: Request) {
  return handle(async () => {
    const response = (await readJson(req, CredentialSchema)) as unknown as AuthenticationResponseJSON;
    const challenge = await consumeChallenge("login");
    const passkey = await getPasskey(response.id);
    if (!passkey) throw new HttpError(401, PASSKEY_FAILED);

    const { rpID, origin } = relyingParty();
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: passkey.id,
        publicKey: new Uint8Array(Buffer.from(passkey.publicKey, "base64url")),
        counter: passkey.counter,
        transports: passkey.transports,
      },
    }).catch((err: unknown) => {
      console.warn("[passkeys] sign-in rejected", err instanceof Error ? err.name : "unknown");
      return null;
    });
    if (!result?.verified) throw new HttpError(401, PASSKEY_FAILED);

    await recordPasskeyUse(passkey.id, result.authenticationInfo.newCounter);
    return json({ customToken: await adminAuth().createCustomToken(passkey.uid) });
  });
}
