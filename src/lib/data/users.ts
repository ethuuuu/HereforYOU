import "server-only";
import type { SessionUser } from "@/lib/auth/session";
import type { UserProfile } from "@/lib/domain/schemas";
import { db } from "@/lib/firebase/admin";
import type { DisplayPrefs } from "@/lib/prefs";

const doc = (uid: string) => db().collection("users").doc(uid);

/** Where someone belongs: their first care circle, or setup if they have none yet. */
export const pathForProfile = (p: Pick<UserProfile, "circleIds"> | undefined) =>
  p?.circleIds?.[0] ? `/c/${p.circleIds[0]}` : "/welcome";

/** Home for a signed-in user. 1 read. */
export async function homePathFor(uid: string): Promise<string> {
  return pathForProfile((await doc(uid).get()).data() as UserProfile | undefined);
}

/**
 * Returns users/{uid}, creating it on first sign-in. New profiles keep the
 * display prefs the person already chose on this device. 1 read (+1 write first time).
 */
export async function ensureUser(user: SessionUser, prefs: DisplayPrefs): Promise<UserProfile> {
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(doc(user.uid));
    if (snap.exists) return snap.data() as UserProfile;
    const profile: UserProfile = {
      displayName: user.name?.trim() || "Friend",
      ...(user.email ? { email: user.email } : {}), // Firestore rejects undefined fields
      circleIds: [],
      prefs,
      createdAt: new Date().toISOString(),
    };
    tx.create(doc(user.uid), profile);
    return profile;
  });
}
