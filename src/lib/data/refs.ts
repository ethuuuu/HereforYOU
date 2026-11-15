import "server-only";
import { db } from "@/lib/firebase/admin";

/** Document paths from AGENTS.md §7, in one place. */
export const circleRef = (circleId: string) => db().collection("circles").doc(circleId);
export const memberRef = (circleId: string, uid: string) => circleRef(circleId).collection("members").doc(uid);
export const userRef = (uid: string) => db().collection("users").doc(uid);
export const circleCodeRef = (code: string) => db().collection("circleCodes").doc(code);
export const activityCol = (circleId: string) => circleRef(circleId).collection("activity");

/** circleCodes/{code} → circleId, or null. 1 read. */
export async function circleIdForCode(code: string): Promise<string | null> {
  const snap = await circleCodeRef(code).get();
  return (snap.data()?.circleId as string | undefined) ?? null;
}
