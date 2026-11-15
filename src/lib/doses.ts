import "server-only";
import { getMedication } from "@/lib/data/medications";
import { dosesForDate, parseDoseId, type DoseInstance } from "@/lib/domain/schedule";
import { addDays, localDateOf } from "@/lib/domain/time";
import { HttpError, NotFoundError } from "@/lib/http";

/**
 * The real scheduled dose behind `doseId`, if it can be logged now (today or yesterday in the
 * circle's zone). Shared by the doses route and the assistant so both check the same rules.
 */
export async function findLoggableDose(circleId: string, timeZone: string, doseId: string): Promise<DoseInstance> {
  const parsed = parseDoseId(doseId);
  if (!parsed) throw new NotFoundError("That dose");
  const med = await getMedication(circleId, parsed.medicationId);
  if (!med) throw new NotFoundError("That medicine");

  const today = localDateOf(new Date(), timeZone);
  if (parsed.localDate !== today && parsed.localDate !== addDays(today, -1)) {
    throw new HttpError(400, "You can only update doses from today or yesterday.");
  }
  // The id must be a dose this medicine really has on that day.
  const dose = dosesForDate([med], parsed.localDate, timeZone).find((d) => d.doseId === doseId);
  if (!dose) throw new NotFoundError("That dose");
  return dose;
}
