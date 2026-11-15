/**
 * Browser side of passkeys: run the WebAuthn ceremony with @simplewebauthn/browser,
 * then (for sign-in) turn the custom token into the normal session cookie.
 */
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { signInWithCustomToken } from "firebase/auth";
import { useSyncExternalStore } from "react";
import { clientAuth } from "@/lib/firebase/client";

class ServerError extends Error {}

async function post<T>(url: string, body: unknown = {}): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ServerError(data.error ?? "Something went wrong. Please try again.");
  return data;
}

/** Custom token → Firebase ID token → session cookie. Returns where to go next (their circle or /welcome). */
async function startSession(customToken: string): Promise<string> {
  const { user } = await signInWithCustomToken(clientAuth(), customToken);
  const { next } = await post<{ next: string }>("/api/session", { idToken: await user.getIdToken() });
  return next;
}

export async function signInWithPasskey(): Promise<string> {
  const optionsJSON = await post<Parameters<typeof startAuthentication>[0]["optionsJSON"]>("/api/passkeys/login/options");
  const response = await startAuthentication({ optionsJSON });
  const { customToken } = await post<{ customToken: string }>("/api/passkeys/login/verify", response);
  return startSession(customToken);
}

/**
 * Creates a passkey. Signed in: adds it to the account and returns null. Signed out
 * (with a name): creates the account, signs in and returns where to go next.
 */
export async function createPasskey(displayName?: string): Promise<string | null> {
  const optionsJSON = await post<Parameters<typeof startRegistration>[0]["optionsJSON"]>(
    "/api/passkeys/register/options",
    displayName ? { displayName } : {},
  );
  const response = await startRegistration({ optionsJSON });
  const { customToken } = await post<{ customToken?: string }>("/api/passkeys/register/verify", response);
  return customToken ? startSession(customToken) : null;
}

/** Plain words for whatever went wrong. */
export function passkeyErrorMessage(err: unknown): string {
  if (err instanceof ServerError) return err.message;
  const name = (err as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "AbortError") return "That was cancelled. Press the button to try again.";
  if (name === "InvalidStateError") return "This device already has a passkey for you.";
  return "That passkey didn't work. Try again or use Google.";
}

const subscribe = () => () => {};
/** False on the server and in browsers without WebAuthn, so passkey buttons stay hidden there. */
export const usePasskeySupport = () => useSyncExternalStore(subscribe, browserSupportsWebAuthn, () => false);
