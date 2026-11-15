import "server-only";
import { db } from "@/lib/firebase/admin";
import type { Member } from "@/lib/domain/schemas";

const col = (circleId: string) => db().collection("circles").doc(circleId).collection("members");

/** Everyone in a circle, oldest first. One query (circles are small). */
export async function listMembers(circleId: string): Promise<Member[]> {
  const snap = await col(circleId).orderBy("joinedAt").get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Member, "id">) }));
}

/** One member of a circle, or null if this user is not in it. 1 read. */
export async function getMember(circleId: string, uid: string): Promise<Member | null> {
  const snap = await col(circleId).doc(uid).get();
  return snap.exists ? { id: snap.id, ...(snap.data() as Omit<Member, "id">) } : null;
}
