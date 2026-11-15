import "server-only";
import type { ReminderKind } from "@/lib/domain/reminders";
import { circleRef } from "./refs";

const sentCol = (circleId: string) => circleRef(circleId).collection("sentReminders");

/** Keys of reminders sent at or after `sinceIso`. One range query; only recent keys are read. */
export async function listSentKeys(circleId: string, sinceIso: string): Promise<Set<string>> {
  const snap = await sentCol(circleId).where("sentAt", ">=", sinceIso).select().get();
  return new Set(snap.docs.map((d) => d.id));
}

/** Marks a reminder as sent so it is never sent again. Call only after a successful send. */
export async function recordSent(circleId: string, key: string, kind: ReminderKind, recipientCount: number): Promise<void> {
  await sentCol(circleId).doc(key).set({ kind, sentAt: new Date().toISOString(), recipientCount });
}
