---
name: passkey-auth
description: Implementing passkey (WebAuthn) sign-up and sign-in for Here For YOU with @simplewebauthn v14, bridged into Firebase Auth via custom tokens and session cookies, plus the Google sign-in fallback. Use this for anything touching /api/passkeys, /api/session, the sign-in or welcome screens, passkey settings, or session handling.
---

# Passkeys + Firebase sessions

Firebase Auth has no built-in passkeys, so we verify WebAuthn ourselves and mint a
Firebase **custom token**. Everything ends in the same Firebase session cookie.

## Versions & APIs (check installed types if unsure)
- `@simplewebauthn/server` v14: `generateRegistrationOptions`, `verifyRegistrationResponse`, `generateAuthenticationOptions`, `verifyAuthenticationResponse`.
- `@simplewebauthn/browser` v14: `startRegistration({ optionsJSON })`, `startAuthentication({ optionsJSON })`, `browserSupportsWebAuthn()`.
- Read the type definitions in `node_modules/@simplewebauthn/server/esm/**/*.d.ts` before writing calls — option names changed across major versions.

## Config
- `rpID = serverEnv().WEBAUTHN_RP_ID` (`localhost` locally; `here-for-you.vercel.app` in prod — no protocol, no port).
- `expectedOrigin = serverEnv().APP_URL` (`http://localhost:3000` locally).
- Registration: `authenticatorSelection: { residentKey: "required", userVerification: "preferred" }` so sign-in needs no username.
- Passkeys only work on the host they were created on. Never change the production domain.

## Flows
**Register** (new account or add passkey):
1. `POST /api/passkeys/register/options` body `{ displayName }` (new) or session user (add). New user: `adminAuth().createUser({ displayName })` first to get a uid. Store challenge in `webauthnChallenges/{randomId}` (5-min expiry); set httpOnly cookie `hfy_wa` = id.
2. Browser: `startRegistration({ optionsJSON })` → POST result to `/api/passkeys/register/verify`.
3. Verify with stored challenge; delete challenge; save `passkeys/{credential.id}` = `{ uid, publicKey: base64url, counter, transports, deviceName, createdAt }`.
4. Return `{ customToken: await adminAuth().createCustomToken(uid) }` (new users) → browser `signInWithCustomToken(clientAuth(), token)` → `getIdToken()` → `POST /api/session`.

**Sign in**:
1. `POST /api/passkeys/login/options` → `generateAuthenticationOptions({ rpID, userVerification: "preferred" })` (no allowCredentials) → challenge stored as above.
2. Browser `startAuthentication({ optionsJSON })` → `/api/passkeys/login/verify`.
3. Look up `passkeys/{response.id}`; verify with its public key + counter; update counter + `lastUsedAt`; custom token → session.

## Security
- Challenges single-use, 5-minute expiry, deleted after verify (success or fail).
- Generic error to the user ("That passkey didn't work. Try again or use Google.") — log details server-side without secrets.
- `createSession` rejects ID tokens older than 5 minutes.
- Show passkey UI only if `browserSupportsWebAuthn()`; always show "Continue with Google".

## Elder-friendly copy
"Sign in with your fingerprint or face — no password to remember." Explain once that the passkey is saved on this phone.

## Tests
Mock `@simplewebauthn/server` and `@/lib/data/passkeys`; cover: success, missing/expired challenge, unknown credential, verification false, counter updated.
