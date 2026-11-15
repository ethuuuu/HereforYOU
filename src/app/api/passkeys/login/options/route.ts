import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { relyingParty, setChallengeCookie } from "@/lib/auth/webauthn";
import { saveChallenge } from "@/lib/data/webauthnChallenges";
import { handle, json } from "@/lib/http";

/** Starts a passkey sign-in. Discoverable credentials: no username, no allowCredentials. */
export function POST() {
  return handle(async () => {
    const options = await generateAuthenticationOptions({ rpID: relyingParty().rpID, userVerification: "preferred" });
    await setChallengeCookie(await saveChallenge({ challenge: options.challenge, purpose: "login" }));
    return json(options);
  });
}
