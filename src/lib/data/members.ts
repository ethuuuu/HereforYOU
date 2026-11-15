import "server-only";
import { db } from "@/lib/firebase/admin";
import type { Member, NotifyPrefs } from "@/lib/domain/schemas";
import { logActivityIn } from "./activity";

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

/** A member changes which reminder emails they get. Saved with an activity entry, atomically. */
export async function updateNotifyPrefs(circleId: string, actor: Pick<Member, "id" | "name">, notify: NotifyPrefs) {
  const batch = db().batch();
  batch.update(col(circleId).doc(actor.id), { notify });
  logActivityIn(batch, circleId, {
    actorUid: actor.id,
    actorName: actor.name,
    action: "member.notify_changed",
    summary: `${actor.name} changed which reminder emails they get`,
  });
  await batch.commit();
}
