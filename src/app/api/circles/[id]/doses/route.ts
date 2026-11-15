import { getCircle } from "@/lib/data/circles";
import { logDose } from "@/lib/data/doseLogs";
import { getMedication } from "@/lib/data/medications";
import { dosesForDate, parseDoseId } from "@/lib/domain/schedule";
import { LogDoseSchema } from "@/lib/domain/schemas";
import { addDays, localDateOf } from "@/lib/domain/time";
import { HttpError, json, NotFoundError, readJson, withCircle } from "@/lib/http";

/** POST /api/circles/[id]/doses — mark one scheduled dose (today or yesterday) as taken or skipped. */
export async function POST(req: Request, ctx: RouteContext<"/api/circles/[id]/doses">) {
  const { id } = await ctx.params;
  return withCircle(req, id, "doses.log", async ({ member }) => {
    const { doseId, status, note } = await readJson(req, LogDoseSchema);
    const parsed = parseDoseId(doseId);
    if (!parsed) throw new NotFoundError("That dose");

    const [circle, med] = await Promise.all([getCircle(id), getMedication(id, parsed.medicationId)]);
    if (!circle) throw new NotFoundError("Care circle");
    if (!med) throw new NotFoundError("That medicine");

    const today = localDateOf(new Date(), circle.timezone);
    if (parsed.localDate !== today && parsed.localDate !== addDays(today, -1)) {
      throw new HttpError(400, "You can only update doses from today or yesterday.");
    }
    // The id must be a dose this medicine really has on that day.
    const dose = dosesForDate([med], parsed.localDate, circle.timezone).find((d) => d.doseId === doseId);
    if (!dose) throw new NotFoundError("That dose");

    const { pillsRemaining } = await logDose(id, member, dose, status, note);
    return json({ ok: true, doseId, status, pillsRemaining: pillsRemaining ?? null });
  });
}
