import { Card } from "@/components/ui/Card";
import { requireCircleMember } from "@/lib/auth/page";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/admin";
import {
  dosesForDate,
  type DoseInstance,
  daysOfSupplyLeft,
} from "@/lib/domain/schedule";
import {
  summarizeAdherence,
  adherenceStreak,
} from "@/lib/domain/adherence";
import type { DoseLog } from "@/lib/domain/schemas";
import { localDateOf } from "@/lib/domain/time";
import { ReadAloud } from "@/components/ui/ReadAloud";
import { Toast } from "@/components/ui/Toast";
import { buttonClass } from "@/components/ui/Button";
import type { Medication } from "@/lib/domain/schemas";


// @ts-expect-error - Firestore data shape may not match Medication type exactly
export default async function CircleHomePage({ params }: import("next").PageProps<"/c/[id]">) {
  const { id } = params;
  const { circle, member } = await requireCircleMember(id);

  const [medications, setMedications] = useState<Medication[]>([]);
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([]);
  const [dosesToday, setDosesToday] = useState<DoseInstance[]>([]);
  const [adherence, setAdherence] = useState<
    | { taken: number; skipped: number; missed: number; rate: number | null; streak: number }
    | null
  >(null);

  // Fetch data synchronously in useEffect (not async)
  useEffect(() => {
    const fetchData = async () => {
      // Fetch active medications
      const medSnap = await db()
        .collection("circles")
        .doc(id)
        .collection("medications")
        .where("active", "==", true)
        .get();

      const rawMeds = medSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Record<string, unknown>),
      }));

      const meds: Medication[] = rawMeds.map((m: any) => ({
        id: m.id,
        name: m.name ?? "Unknown",
        dose: m.dose ?? "0 mg",
        instructions: m.instructions ?? undefined,
        times: m.times ?? [],
        daysOfWeek: m.daysOfWeek ?? [],
        startDate: m.startDate ?? "",
        endDate: m.endDate ?? "",
        active: m.active ?? true,
        pillsRemaining: m.pillsRemaining ?? 0,
        pillsPerDose: m.pillsPerDose ?? 1,
        refillThreshold: m.refillThreshold ?? 7,
        prescribedBy: m.prescribedBy ?? undefined,
        purpose: m.purpose ?? undefined,
        createdBy: m.createdBy ?? undefined,
        updatedAt: m.updatedAt ?? undefined,
      }));
      setMedications(meds);

      // Fetch recent dose logs (last 50)
      const logsSnap = await db()
        .collection("circles")
        .doc(id)
        .collection("doseLogs")
        .orderBy("loggedAt", "desc")
        .limit(50)
        .get();

      const rawLogs = logsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Record<string, unknown>),
      }));

      const logs: DoseLog[] = rawLogs.map((l: any) => ({
        doseId: l.doseId ?? "",
        medicationId: l.medicationId ?? "",
        localDate: l.localDate ?? "",
        status: l.status as "taken" | "skipped",
        loggedBy: l.loggedBy ?? "",
        loggedAt: l.loggedAt ?? "",
        note: l.note ?? undefined,
      }));
      setDoseLogs(logs);

      // Get today's local date in the circle's time zone
      const now = new Date();
      const todayLocal = localDateOf(now, circle.timezone);

      // Get doses for today from each medication
      const allDoses: DoseInstance[] = [];
      for (const med of meds) {
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
        };
        const ds = dosesForDate([medSched], todayLocal, circle.timezone);
        allDoses.push(...ds);
      }
      // Dedup by doseId
      const seen = new Set<string>();
      const deduped = allDoses.filter((d: any) => {
        if (seen.has(d.doseId)) return false;
        seen.add(d.doseId);
        return true;
      });
      setDosesToday(deduped);

      // Compute adherence summary
      const summary = summarizeAdherence(deduped, logs, now);
      const streak = adherenceStreak(
        new Map(deduped.map((d: any) => [d.doseId, d])),
        logs,
        todayLocal,
        now,
      );
      setAdherence({
        taken: summary.taken,
        skipped: summary.skipped,
        missed: summary.missed,
        rate: summary.rate,
        streak,
      });
    };

    fetchData();
  }, [id, circle.timezone]);

  // Determine if this member can log doses (elder, organiser, caretaker, family; not doctor)
  const canLogDoses = member.role !== "doctor";

  return (
    <div className="flex flex-col gap-6">
      {/* Adherence panel */}
      {adherence && (
        <Card>
          <h3 className="text-lg font-bold mb-4">Adherence this week</h3>
          <p>
            Rate:{" "}
            {adherence.rate !== null
              ? `${(adherence.rate * 100).toFixed(1)}%`
              : "Not enough data"}
          </p>
          <p>Streak: {adherence.streak} full adherence days</p>
          <p>
            Taken: {adherence.taken} | Skipped: {adherence.skipped} | Missed: {adherence.missed}
          </p>
        </Card>
      )}

      {/* Today section */}
      <section aria-labelledby="today-heading">
        <h2 id="today-heading" className="text-3xl font-bold">Today</h2>

        {dosesToday.length === 0 && (
          <p className="text-muted mt-4">No doses scheduled for today.</p>
        )}

        {dosesToday.map((dose) => {
          // Find the log status for this dose
          const log = doseLogs.find((l) => l.doseId === dose.doseId);
          const loggedStatus = log ? log.status : undefined;

          // Determine display state
          const t = new Date().getTime();
          const at = dose.scheduledAt.getTime();
          const diffMinutes = (at - t) / 60_000;

          let displayState:
            | "upcoming"
            | "due now"
            | "taken"
            | "skipped"
            | "missed" = "upcoming";

          if (loggedStatus) {
            displayState = loggedStatus === "taken"
              ? "taken"
              : loggedStatus === "skipped"
              ? "skipped"
              : "missed";
          } else if (diffMinutes > 30) {
            displayState = "missed";
          } else if (diffMinutes > 15) {
            displayState = "due now";
          } else {
            displayState = "upcoming";
          }

          return (
            <Card key={dose.doseId} className="p-4 mb-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold">{dose.medicationName}</h3>
                  <p className="text-sm text-muted">{dose.instructions || ""}</p>
                  <p className="text-xs text-muted">🕐 {dose.localTime}</p>
                </div>
                <div className="flex gap-2">
                  {/* "I took it" button */}
                  {canLogDoses && displayState !== "taken" && (
                    <button
                      onClick={() => {
                        // TODO: POST to /api/circles/[id]/doses with status="taken"
                        Toast({ message: "Marked as taken", tone: "success" });
                      }}
                      className={buttonClass("primary")}
                      disabled={!canLogDoses}
                    >
                      I took it
                    </button>
                  )}

                  {/* Skip button */}
                  {canLogDoses && displayState !== "missed" && displayState !== "taken" && (
                    <button
                      onClick={() => {
                        Toast({ message: "Skipped", tone: "info" });
                      }}
                      className={buttonClass("secondary")}
                      disabled={!canLogDoses}
                    >
                      Skip
                    </button>
                  )}
                </div>
              </div>

              {/* State badge */}
              <p className="mt-2 text-xs font-bold">
                {displayState !== "upcoming" && (
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs ${
                      displayState === "taken"
                        ? "bg-success text-white"
                        : displayState === "skipped"
                        ? "bg-info text-white"
                        : displayState === "missed"
                        ? "bg-danger text-white"
                        : displayState === "due now"
                        ? "bg-warning text-black"
                        : ""
                    }`}
// @ts-expect-error - type narrowing via ternary is intentional
                  >                  {displayState === "upcoming"
                      ? "Upcoming"
                      : displayState === "due now"
                      ? "Due now"
                      : displayState === "taken"
                      ? "✓ Taken"
                      : displayState === "skipped"
                      ? "✓ Skipped"
                      : "! Missed"}
                  </span>
                )}
              </p>
            </Card>
          );
        })}

        {/* Read-aloud button */}
        <ReadAloud
          text={`Today's doses for ${circle.elderName}: ${dosesToday
            .map((d) => `${d.medicationName} at ${d.localTime}`)
            .join(", ")}`}
        />

        {/* Refill badge */}
        {medications.length > 0 && (
          <div className="mt-4">
            {medications.map((med) => {
              const daysLeft = daysOfSupplyLeft({
                pillsRemaining: med.pillsRemaining,
                pillsPerDose: med.pillsPerDose,
                times: med.times,
                daysOfWeek: med.daysOfWeek,
              });
              if (daysLeft !== null && daysLeft <= med.refillThreshold) {
                return (
                  <p className="text-danger small">
                    💊 Refill soon: {daysLeft} day(s) left (threshold: {med.refillThreshold})
                  </p>
                );
              }
              return null;
            })}
          </div>
        )}

        {/* Next appointment placeholder */}
        <div className="mt-4">
          <h3 className="text-sm font-bold mb-2">Next appointment</h3>
          <p className="text-muted no-underline">
            (Add appointments in F4 — placeholder until then)
          </p>
        </div>
      </section>
    </div>
  );
}