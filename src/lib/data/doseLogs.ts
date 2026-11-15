import "server-only";
import type { DoseInstance } from "@/lib/domain/schedule";
import type { DoseLog, DoseStatus, Medication, Member } from "@/lib/domain/schemas";
import { db } from "@/lib/firebase/admin";
import { logActivityIn } from "./activity";
import { medicationsCol } from "./medications";
import { circleRef } from "./refs";

const logsCol = (circleId: string) => circleRef(circleId).collection("doseLogs");

/** Logs for an inclusive range of local dates. One range query on `localDate`. */
export async function listDoseLogs(circleId: string, fromDate: string, toDate: string): Promise<DoseLog[]> {
  const snap = await logsCol(circleId).where("localDate", ">=", fromDate).where("localDate", "<=", toDate).get();
  return snap.docs.map((d) => d.data() as DoseLog);
}

/**
 * Records a dose as taken/skipped (re-logging overwrites), and the activity entry, in one
 * transaction. Pills are only counted down when a dose newly becomes "taken".
 * Returns the medicine's pills remaining afterwards (undefined if not tracked).
 */
export async function logDose(
  circleId: string,
  actor: Member,
  dose: DoseInstance,
  status: DoseStatus,
  note?: string,
): Promise<{ pillsRemaining?: number }> {
  const logRef = logsCol(circleId).doc(dose.doseId);
  const medRef = medicationsCol(circleId).doc(dose.medicationId);
  return db().runTransaction(async (tx) => {
    // Firestore transactions need every read before any write.
    const [logSnap, medSnap] = await Promise.all([tx.get(logRef), tx.get(medRef)]);
    const previous = logSnap.data() as DoseLog | undefined;
    const med = medSnap.data() as Medication | undefined;
    const now = new Date().toISOString();

    const log: DoseLog = {
      doseId: dose.doseId,
      medicationId: dose.medicationId,
      localDate: dose.localDate,
      status,
      loggedBy: actor.id,
      loggedAt: now,
      ...(note ? { note } : {}),
    };
    tx.set(logRef, log);

    let pillsRemaining = med?.pillsRemaining;
    if (status === "taken" && previous?.status !== "taken" && pillsRemaining !== undefined) {
      pillsRemaining = Math.max(0, pillsRemaining - (med?.pillsPerDose ?? 1));
      tx.update(medRef, { pillsRemaining, updatedAt: now });
    }

    const what = `${dose.medicationName} (${dose.localTime})`;
    logActivityIn(tx, circleId, {
      actorUid: actor.id,
      actorName: actor.name,
      action: `dose.${status}`,
      summary: status === "taken" ? `${actor.name} marked ${what} as taken` : `${actor.name} skipped ${what}`,
    });
    return { pillsRemaining };
  });
}
