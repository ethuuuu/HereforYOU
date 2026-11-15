import { logActivityIn } from "@/lib/data/activity";
import { z } from "zod";
import { localDateOf } from "@/lib/domain/time";
import {
  daysOfSupplyLeft,
  type DoseInstance,
  dosesForDate,
} from "@/lib/domain/schedule";
import { type Medication, type Member } from "@/lib/domain/schemas";
import { db } from "@/lib/firebase/admin";
import { LogDoseSchema } from "@/lib/domain/schemas";
import { handle, HttpError, json, readJson, withCircle } from "@/lib/http";
import type { DoseLog } from "@/lib/domain/schemas";
import type { Circle } from "@/lib/domain/schemas";

export type DoseLogInput = {
  status: "taken" | "skipped";
  note?: string;
};

/** POST /api/circles/[id]/doses — log a taken/skipped dose */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const circleId = (await context.params).id;

  return withCircle(req, circleId, "doses.log", async ({ user, member }) => {
    // Fetch the full circle data
    const circleSnap = await db().collection("circles").doc(circleId).get();
    const circle = circleSnap.data() as Circle | undefined;
    if (!circle) throw new HttpError(404, "Care circle not found");

    const input = await readJson<DoseLogInput>(req, LogDoseSchema);
    const { status, note } = input;
    const now = new Date();
    const localToday = localDateOf(now, circle.timezone);

    // Fetch active medications for this circle
    const medSnap = await db()
      .collection("circles")
      .doc(circleId)
      .collection("medications")
      .where("active", "==", true)
      .get();

    const rawMeds = medSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Record<string, unknown>),
    }));

    // Medications from Firestore
    const medications: any[] = medSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Record<string, unknown>),
    }));

    // Get doses for today from each medication
    const dosesToday: DoseInstance[] = [];
    for (const med of medications) {
      if (!med.active) continue;
      const medSched = {
        id: med.id,
        name: med.name,
        dose: med.dose,
        instructions: med.instructions,
        times: med.times,
        daysOfWeek: med.daysOfWeek,
        startDate: med.startDate,
        endDate: med.endDate,
        active: med.active,
      } as const;
      const ds = dosesForDate([medSched], localToday, circle.timezone);
      dosesToday.push(...ds);
    }

    if (dosesToday.length === 0) {
      return json({ error: "No doses scheduled for today in this time zone." }, 400);
    }

    // Use the first dose scheduled for today
    const dose = dosesToday[0];
    const doseId = dose.doseId;

    // Build the dose log entry
    // Member.id is the Firebase Auth uid
    const log: DoseLog = {
      doseId,
      medicationId: dose.medicationId,
      localDate: localToday,
      status,
      loggedBy: member.id,
      loggedAt: now.toISOString(),
      ...(note && { note }),
    };

    // Transaction: log the dose + update pillsRemaining + activity entry
    await db().runTransaction(async (tx) => {
      // Create dose log
      tx.create(
        db()
          .collection("circles")
          .doc(circleId)
          .collection("doseLogs")
          .doc(doseId),
        log,
      );

      // If taken, decrement pillsRemaining on the medication
      if (status === "taken") {
        const medDoc = db()
          .collection("circles")
          .doc(circleId)
          .collection("medications")
          .doc(dose.medicationId);
        const medSnap = await tx.get(medDoc);
        const medData = medSnap.data() as {
          pillsRemaining?: number;
          updatedAt?: string;
        } | undefined;
        if (medData?.pillsRemaining !== undefined) {
          tx.update(medDoc, {
            pillsRemaining: medData.pillsRemaining - 1,
            updatedAt: now.toISOString(),
          });
        }
      }

      // Activity entry
      // Member has 'id' (Firebase uid) and 'name' from schemas
      const actorUid = member.id;
      const actorName = member.name;
      logActivityIn(tx, circleId, {
        actorUid,
        actorName,
        action: "dose." + status,
        summary: status === "taken"
          ? `${actorName} took ${dose.medicationName}`
          : `${actorName} skipped ${dose.medicationName}`,
      });
    });

    // Return updated pillsRemaining (read from medication doc after tx)
    const finalMedDoc = await db()
      .collection("circles")
      .doc(circleId)
      .collection("medications")
      .doc(dose.medicationId)
      .get();
    const finalPills = finalMedDoc.data() as { pillsRemaining?: number } | {};
    const pillsRemaining = "pillsRemaining" in finalPills ? finalPills.pillsRemaining : undefined;
    return json({ ok: true, doseId, pillsRemaining: pillsRemaining ?? 0 });
  });
}