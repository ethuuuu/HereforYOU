import { createMedication } from "@/lib/data/medications";
import { MedicationInputSchema } from "@/lib/domain/schemas";
import { json, readJson, withCircle } from "@/lib/http";

/** POST /api/circles/[id]/medications — add a medicine. */
export async function POST(req: Request, ctx: RouteContext<"/api/circles/[id]/medications">) {
  const { id } = await ctx.params;
  return withCircle(req, id, "medications.edit", async ({ member }) => {
    const input = await readJson(req, MedicationInputSchema);
    const medId = await createMedication(id, member, input);
    return json({ id: medId }, 201);
  });
}
