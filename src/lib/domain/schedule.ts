/**
 * Turns medication schedules into concrete dose instances.
 * Pure functions: no I/O, fully unit-tested.
 */
import type { Medication } from "./schemas";
import { addDays, dayOfWeek, zonedToUtc } from "./time";

export type DoseInstance = {
  doseId: string;
  medicationId: string;
  medicationName: string;
  dose: string;
  instructions?: string;
  localDate: string; // YYYY-MM-DD in the elder's zone
  localTime: string; // HH:MM in the elder's zone
  scheduledAt: Date; // UTC instant
};

type SchedulableMed = Pick<
  Medication,
  "id" | "name" | "dose" | "instructions" | "times" | "daysOfWeek" | "startDate" | "endDate" | "active"
>;

/** Stable, human-readable id for one dose: `${medicationId}_${YYYY-MM-DD}_${HHMM}`. */
export function makeDoseId(medicationId: string, localDate: string, localTime: string): string {
  return `${medicationId}_${localDate}_${localTime.replace(":", "")}`;
}

/** Is this medication scheduled at all on the given local date? */
export function isScheduledOn(med: SchedulableMed, localDate: string): boolean {
  if (!med.active) return false;
  if (localDate < med.startDate) return false;
  if (med.endDate && localDate > med.endDate) return false;
  return med.daysOfWeek.includes(dayOfWeek(localDate));
}

/** All doses for one local date, sorted by time. */
export function dosesForDate(meds: SchedulableMed[], localDate: string, timeZone: string): DoseInstance[] {
  const doses: DoseInstance[] = [];
  for (const med of meds) {
    if (!isScheduledOn(med, localDate)) continue;
    for (const localTime of [...new Set(med.times)]) {
      doses.push({
        doseId: makeDoseId(med.id, localDate, localTime),
        medicationId: med.id,
        medicationName: med.name,
        dose: med.dose,
        instructions: med.instructions,
        localDate,
        localTime,
        scheduledAt: zonedToUtc(localDate, localTime, timeZone),
      });
    }
  }
  return doses.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}

/** Doses across an inclusive range of local dates. */
export function dosesForRange(
  meds: SchedulableMed[],
  fromDate: string,
  toDate: string,
  timeZone: string,
): DoseInstance[] {
  const all: DoseInstance[] = [];
  for (let d = fromDate; d <= toDate; d = addDays(d, 1)) {
    all.push(...dosesForDate(meds, d, timeZone));
  }
  return all;
}

/** Estimated days of supply left, or null if pill count isn't tracked. */
export function daysOfSupplyLeft(
  med: Pick<Medication, "pillsRemaining" | "pillsPerDose" | "times" | "daysOfWeek">,
): number | null {
  if (med.pillsRemaining === undefined) return null;
  const pillsPerWeek = med.pillsPerDose * med.times.length * med.daysOfWeek.length;
  if (pillsPerWeek === 0) return null;
  return Math.floor((med.pillsRemaining / pillsPerWeek) * 7);
}
