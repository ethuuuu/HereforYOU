import "server-only";
import type { Transaction, WriteBatch } from "firebase-admin/firestore";
import type { ActivityEntry } from "@/lib/domain/schemas";
import { activityCol } from "./refs";

export type NewActivity = Omit<ActivityEntry, "id" | "at">;

/** Adds an activity entry as part of a transaction/batch, so the change and its log land together. */
export function logActivityIn(tx: Transaction | WriteBatch, circleId: string, entry: NewActivity): void {
  tx.create(activityCol(circleId).doc(), { ...entry, at: new Date().toISOString() });
}

/** Newest first. One query, capped. */
export async function listActivity(circleId: string, limit = 50): Promise<ActivityEntry[]> {
  const snap = await activityCol(circleId).orderBy("at", "desc").limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityEntry, "id">) }));
}
