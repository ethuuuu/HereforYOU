import { createAppointment } from "@/lib/data/appointments";
import { getCircle } from "@/lib/data/circles";
import { AppointmentInputSchema } from "@/lib/domain/schemas";
import { zonedToUtc } from "@/lib/domain/time";
import { json, NotFoundError, readJson, withCircle } from "@/lib/http";

/** POST /api/circles/[id]/appointments — add a visit. `startsAt` is computed here in the circle's time zone. */
export async function POST(req: Request, ctx: RouteContext<"/api/circles/[id]/appointments">) {
  const { id } = await ctx.params;
  return withCircle(req, id, "appointments.edit", async ({ member }) => {
    const input = await readJson(req, AppointmentInputSchema);
    const circle = await getCircle(id);
    if (!circle) throw new NotFoundError("That care circle");
    const startsAt = zonedToUtc(input.date, input.time, circle.timezone).toISOString();
    const apptId = await createAppointment(id, member, input, startsAt);
    return json({ id: apptId }, 201);
  });
}
