import { stopMedication, updateMedication } from "@/lib/data/medications";
import { MedicationInputSchema } from "@/lib/domain/schemas";
import { isSafeId, json, NotFoundError, readJson, withCircle } from "@/lib/http";

type Ctx = RouteContext<"/api/circles/[id]/medications/[medId]">;

/** PATCH — replace a medicine's details. */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id, medId } = await ctx.params;
  return withCircle(req, id, "medications.edit", async ({ member }) => {
    if (!isSafeId(medId)) throw new NotFoundError("That medicine");
    const input = await readJson(req, MedicationInputSchema);
    if (!(await updateMedication(id, member, medId, input))) throw new NotFoundError("That medicine");
    return json({ ok: true });
  });
}

/** DELETE — stop a medicine. It stays in history but is no longer scheduled. */
export async function DELETE(req: Request, ctx: Ctx) {
  const { id, medId } = await ctx.params;
  return withCircle(req, id, "medications.edit", async ({ member }) => {
    if (!isSafeId(medId)) throw new NotFoundError("That medicine");
    if (!(await stopMedication(id, member, medId))) throw new NotFoundError("That medicine");
    return json({ ok: true });
  });
}
