import { getCircle } from "@/lib/data/circles";
import { logDose } from "@/lib/data/doseLogs";
import { findLoggableDose } from "@/lib/doses";
import { LogDoseSchema } from "@/lib/domain/schemas";
import { json, NotFoundError, readJson, withCircle } from "@/lib/http";

/** POST /api/circles/[id]/doses — mark one scheduled dose (today or yesterday) as taken or skipped. */
export async function POST(req: Request, ctx: RouteContext<"/api/circles/[id]/doses">) {
  const { id } = await ctx.params;
  return withCircle(req, id, "doses.log", async ({ member }) => {
    const { doseId, status, note } = await readJson(req, LogDoseSchema);
    const circle = await getCircle(id);
    if (!circle) throw new NotFoundError("Care circle");
    const dose = await findLoggableDose(id, circle.timezone, doseId);
    const { pillsRemaining } = await logDose(id, member, dose, status, note);
    return json({ ok: true, doseId, status, pillsRemaining: pillsRemaining ?? null });
  });
}
