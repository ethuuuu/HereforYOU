import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import type { Medication, MedicationInput, Member } from "@/lib/domain/schemas";
import { db } from "@/lib/firebase/admin";
import { logActivityIn } from "./activity";
import { circleRef } from "./refs";

export const medicationsCol = (circleId: string) => circleRef(circleId).collection("medications");

const toMed = (d: DocumentSnapshot): Medication => ({ id: d.id, ...(d.data() as Omit<Medication, "id">) });

/** Every medicine (active and stopped), by name. One query. */
export async function listMedications(circleId: string): Promise<Medication[]> {
  const snap = await medicationsCol(circleId).orderBy("name").get();
  return snap.docs.map(toMed);
}

/** Only medicines still being taken — what the Today view and reminders need. */
export async function listActiveMedications(circleId: string): Promise<Medication[]> {
  const snap = await medicationsCol(circleId).where("active", "==", true).get();
  return snap.docs.map(toMed);
}

/** One medicine, or null. 1 read. */
export async function getMedication(circleId: string, medId: string): Promise<Medication | null> {
  const snap = await medicationsCol(circleId).doc(medId).get();
  return snap.exists ? toMed(snap) : null;
}

/** Adds a medicine and logs who added it, atomically. Returns the new id. */
export async function createMedication(circleId: string, actor: Member, input: MedicationInput): Promise<string> {
  const ref = medicationsCol(circleId).doc();
  const batch = db().batch();
  batch.create(ref, { ...input, active: true, createdBy: actor.id, updatedAt: new Date().toISOString() });
  logActivityIn(batch, circleId, {
    actorUid: actor.id,
    actorName: actor.name,
    action: "medication.added",
    summary: `${actor.name} added ${input.name} (${input.dose})`,
  });
  await batch.commit();
  return ref.id;
}

/** Replaces a medicine's details (so cleared fields really clear). False if it doesn't exist. */
export async function updateMedication(
  circleId: string,
  actor: Member,
  medId: string,
  input: MedicationInput,
): Promise<boolean> {
  const ref = medicationsCol(circleId).doc(medId);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const { active, createdBy } = snap.data() as Medication;
    tx.set(ref, { ...input, active, createdBy, updatedAt: new Date().toISOString() });
    logActivityIn(tx, circleId, {
      actorUid: actor.id,
      actorName: actor.name,
      action: "medication.edited",
      summary: `${actor.name} changed ${input.name}`,
    });
    return true;
  });
}

/** Stops a medicine (kept for history, no longer scheduled). False if it doesn't exist. */
export async function stopMedication(circleId: string, actor: Member, medId: string): Promise<boolean> {
  const ref = medicationsCol(circleId).doc(medId);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    tx.update(ref, { active: false, updatedAt: new Date().toISOString() });
    logActivityIn(tx, circleId, {
      actorUid: actor.id,
      actorName: actor.name,
      action: "medication.stopped",
      summary: `${actor.name} stopped ${(snap.data() as Medication).name}`,
    });
    return true;
  });
}
