import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import type { Appointment, AppointmentInput, Member } from "@/lib/domain/schemas";
import { db } from "@/lib/firebase/admin";
import { logActivityIn } from "./activity";
import { circleRef } from "./refs";

export const appointmentsCol = (circleId: string) => circleRef(circleId).collection("appointments");

const toAppt = (d: DocumentSnapshot): Appointment => ({ id: d.id, ...(d.data() as Omit<Appointment, "id">) });

/** Appointments starting in [fromIso, toIso), soonest first. No `toIso` = everything from `fromIso` on. */
export async function listAppointmentsBetween(circleId: string, fromIso: string, toIso?: string): Promise<Appointment[]> {
  let q = appointmentsCol(circleId).where("startsAt", ">=", fromIso);
  if (toIso) q = q.where("startsAt", "<", toIso);
  const snap = await q.orderBy("startsAt").get();
  return snap.docs.map(toAppt);
}

/** Most recent appointments before `beforeIso`, newest first, capped. */
export async function listPastAppointments(circleId: string, beforeIso: string, limit = 20): Promise<Appointment[]> {
  const snap = await appointmentsCol(circleId).where("startsAt", "<", beforeIso).orderBy("startsAt", "desc").limit(limit).get();
  return snap.docs.map(toAppt);
}

/** The next appointment from `now`, or null. 1 read. */
export async function nextAppointment(circleId: string, now: Date): Promise<Appointment | null> {
  const snap = await appointmentsCol(circleId).where("startsAt", ">=", now.toISOString()).orderBy("startsAt").limit(1).get();
  return snap.empty ? null : toAppt(snap.docs[0]);
}

/** One appointment, or null. 1 read. */
export async function getAppointment(circleId: string, apptId: string): Promise<Appointment | null> {
  const snap = await appointmentsCol(circleId).doc(apptId).get();
  return snap.exists ? toAppt(snap) : null;
}

/** Adds an appointment and logs it, atomically. `startsAt` is computed by the caller in the circle's zone. */
export async function createAppointment(
  circleId: string,
  actor: Member,
  input: AppointmentInput,
  startsAt: string,
): Promise<string> {
  const ref = appointmentsCol(circleId).doc();
  const batch = db().batch();
  batch.create(ref, { ...input, startsAt, createdBy: actor.id });
  logActivityIn(batch, circleId, {
    actorUid: actor.id,
    actorName: actor.name,
    action: "appointment.added",
    summary: `${actor.name} added a visit with ${input.doctorName} on ${input.date} at ${input.time}`,
  });
  await batch.commit();
  return ref.id;
}

/** Replaces an appointment's details (keeps who made it and any suggested questions). False if missing. */
export async function updateAppointment(
  circleId: string,
  actor: Member,
  apptId: string,
  input: AppointmentInput,
  startsAt: string,
): Promise<boolean> {
  const ref = appointmentsCol(circleId).doc(apptId);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const { createdBy, questions } = snap.data() as Appointment;
    tx.set(ref, { ...input, startsAt, createdBy, ...(questions ? { questions } : {}) });
    logActivityIn(tx, circleId, {
      actorUid: actor.id,
      actorName: actor.name,
      action: "appointment.edited",
      summary: `${actor.name} changed the visit with ${input.doctorName} to ${input.date} at ${input.time}`,
    });
    return true;
  });
}

/** Deletes an appointment. False if missing. */
export async function deleteAppointment(circleId: string, actor: Member, apptId: string): Promise<boolean> {
  const ref = appointmentsCol(circleId).doc(apptId);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const { doctorName, date } = snap.data() as Appointment;
    tx.delete(ref);
    logActivityIn(tx, circleId, {
      actorUid: actor.id,
      actorName: actor.name,
      action: "appointment.deleted",
      summary: `${actor.name} removed the visit with ${doctorName} on ${date}`,
    });
    return true;
  });
}

/** Saves the questions the user confirmed for a visit (replacing any before). False if missing. */
export async function setAppointmentQuestions(
  circleId: string,
  actor: Member,
  apptId: string,
  questions: string[],
): Promise<boolean> {
  const ref = appointmentsCol(circleId).doc(apptId);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const { doctorName } = snap.data() as Appointment;
    tx.update(ref, { questions });
    logActivityIn(tx, circleId, {
      actorUid: actor.id,
      actorName: actor.name,
      action: "appointment.questions",
      summary: `${actor.name} saved ${questions.length} question${questions.length === 1 ? "" : "s"} for the visit with ${doctorName}`,
    });
    return true;
  });
}
