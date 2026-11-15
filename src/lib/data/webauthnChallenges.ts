import "server-only";
import { db } from "@/lib/firebase/admin";

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type ChallengePurpose = "register" | "login";
/** What a passkey ceremony needs to remember between "options" and "verify". */
export type Challenge = {
  challenge: string;
  purpose: ChallengePurpose;
  uid?: string;
  /** Set when the passkey creates a brand-new account. */
  newUser?: { displayName: string };
};

const col = () => db().collection("webauthnChallenges");

/** Stores a challenge for 5 minutes and returns its id (kept in an httpOnly cookie). */
export async function saveChallenge(c: Challenge): Promise<string> {
  const ref = col().doc();
  await ref.create({ ...c, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString() });
  return ref.id;
}

/**
 * One-time use: reads and deletes the challenge in one transaction. Null when it is
 * missing, already used, expired or for a different purpose.
 */
export async function takeChallenge(id: string, purpose: ChallengePurpose): Promise<Challenge | null> {
  const ref = col().doc(id);
  const data = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    tx.delete(ref);
    return snap.data() as Challenge & { expiresAt: string };
  });
  if (!data || data.purpose !== purpose || Date.parse(data.expiresAt) < Date.now()) return null;
  return { challenge: data.challenge, purpose: data.purpose, uid: data.uid, newUser: data.newUser };
}
