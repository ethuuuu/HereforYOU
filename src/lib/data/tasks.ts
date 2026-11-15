import "server-only";
import type { Member, Task, TaskInput } from "@/lib/domain/schemas";
import { db } from "@/lib/firebase/admin";
import { logActivityIn } from "./activity";
import { circleRef } from "./refs";

const tasksCol = (circleId: string) => circleRef(circleId).collection("tasks");

/** Tasks due on one local date, earliest first (untimed last). 1 query, single-field filter. */
export async function listTasksForDate(circleId: string, date: string): Promise<Task[]> {
  const snap = await tasksCol(circleId).where("date", "==", date).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Task, "id">) }))
    .sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
}

/** Adds a task and logs it, atomically. */
export async function createTask(circleId: string, actor: Member, input: TaskInput): Promise<string> {
  const ref = tasksCol(circleId).doc();
  const batch = db().batch();
  batch.create(ref, { ...input, createdBy: actor.id, createdAt: new Date().toISOString() });
  logActivityIn(batch, circleId, {
    actorUid: actor.id,
    actorName: actor.name,
    action: "task.added",
    summary: `${actor.name} added a reminder: ${input.title} (${input.date}${input.time ? ` at ${input.time}` : ""})`,
  });
  await batch.commit();
  return ref.id;
}
