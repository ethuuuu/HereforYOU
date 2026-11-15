import { deleteAppointment, updateAppointment } from "@/lib/data/appointments";
import { getCircle } from "@/lib/data/circles";
import { AppointmentInputSchema } from "@/lib/domain/schemas";
import { zonedToUtc } from "@/lib/domain/time";
import { isSafeId, json, NotFoundError, readJson, withCircle } from "@/lib/http";

type Ctx = RouteContext<"/api/circles/[id]/appointments/[apptId]">;

/** PATCH — replace a visit's details; `startsAt` is recomputed in the circle's time zone. */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id, apptId } = await ctx.params;
  return withCircle(req, id, "appointments.edit", async ({ member }) => {
    if (!isSafeId(apptId)) throw new NotFoundError("That appointment");
    const input = await readJson(req, AppointmentInputSchema);
    const circle = await getCircle(id);
    if (!circle) throw new NotFoundError("That care circle");
    const startsAt = zonedToUtc(input.date, input.time, circle.timezone).toISOString();
    if (!(await updateAppointment(id, member, apptId, input, startsAt))) throw new NotFoundError("That appointment");
    return json({ ok: true });
  });
}

/** DELETE — remove a visit. */
export async function DELETE(req: Request, ctx: Ctx) {
  const { id, apptId } = await ctx.params;
  return withCircle(req, id, "appointments.edit", async ({ member }) => {
    if (!isSafeId(apptId)) throw new NotFoundError("That appointment");
    if (!(await deleteAppointment(id, member, apptId))) throw new NotFoundError("That appointment");
    return json({ ok: true });
  });
}
