import "server-only";
import { db } from "@/lib/firebase/admin";
import type { Member } from "@/lib/domain/schemas";

const col = (circleId: string) => db().collection("circles").doc(circleId).collection("members");

/** One member of a circle, or null if this user is not in it. 1 read. */
export async function getMember(circleId: string, uid: string): Promise<Member | null> {
  const snap = await col(circleId).doc(uid).get();
  return snap.exists ? { id: snap.id, ...(snap.data() as Omit<Member, "id">) } : null;
}
