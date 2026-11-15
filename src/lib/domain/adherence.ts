/**
 * Adherence maths. A dose counts as "missed" once its grace period has passed
 * without a log; until then it is "pending" (or "due").
 */
import type { DoseLog } from "./schemas";
import type { DoseInstance } from "./schedule";
import { MISSED_AFTER_MINUTES } from "./reminders";
import { MINUTE } from "./time";

export type DoseState = "taken" | "skipped" | "missed" | "due" | "upcoming";

export function doseState(dose: DoseInstance, log: DoseLog | undefined, now: Date): DoseState {
  if (log) return log.status;
  const t = now.getTime();
  const at = dose.scheduledAt.getTime();
  if (t >= at + MISSED_AFTER_MINUTES * MINUTE) return "missed";
  if (t >= at) return "due";
  return "upcoming";
}

export type AdherenceSummary = {
  taken: number;
  skipped: number;
  missed: number;
  pending: number; // due + upcoming
  /** taken ÷ (taken + skipped + missed); null when nothing is decided yet. */
  rate: number | null;
};

export function summarizeAdherence(doses: DoseInstance[], logs: DoseLog[], now: Date): AdherenceSummary {
  const byId = new Map(logs.map((l) => [l.doseId, l]));
  const summary: AdherenceSummary = { taken: 0, skipped: 0, missed: 0, pending: 0, rate: null };
  for (const dose of doses) {
    const state = doseState(dose, byId.get(dose.doseId), now);
    if (state === "taken") summary.taken++;
    else if (state === "skipped") summary.skipped++;
    else if (state === "missed") summary.missed++;
    else summary.pending++;
  }
  const decided = summary.taken + summary.skipped + summary.missed;
  summary.rate = decided === 0 ? null : summary.taken / decided;
  return summary;
}

/**
 * Consecutive fully-adherent days ending yesterday (today is still in progress).
 * `dosesByDate` maps local date → that day's doses; days without doses are skipped over.
 */
export function adherenceStreak(
  dosesByDate: Map<string, DoseInstance[]>,
  logs: DoseLog[],
  today: string,
  now: Date,
): number {
  const byId = new Map(logs.map((l) => [l.doseId, l]));
  const pastDates = [...dosesByDate.keys()].filter((d) => d < today).sort().reverse();
  let streak = 0;
  for (const date of pastDates) {
    const doses = dosesByDate.get(date) ?? [];
    if (doses.length === 0) continue;
    const allTaken = doses.every((d) => doseState(d, byId.get(d.doseId), now) === "taken");
    if (!allTaken) break;
    streak++;
  }
  return streak;
}
