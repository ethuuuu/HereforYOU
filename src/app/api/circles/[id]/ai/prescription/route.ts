import { AIError, generateJSON } from "@/lib/ai/gemini";
import { prescriptionPrompt, PrescriptionDraftSchema } from "@/lib/ai/prompts";
import { PrescriptionRequestSchema } from "@/lib/domain/schemas";
import { json, readJson, withCircle } from "@/lib/http";

/**
 * POST /api/circles/[id]/ai/prescription — pasted text and/or a photo → a DRAFT list of medicines.
 * Nothing is saved here: the user edits and confirms each draft, which then goes through the normal medications route.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/circles/[id]/ai/prescription">) {
  const { id } = await ctx.params;
  return withCircle(req, id, "ai.use", async () => {
    const { text, image } = await readJson(req, PrescriptionRequestSchema);
    try {
      const draft = await generateJSON(PrescriptionDraftSchema, {
        ...prescriptionPrompt({ text, hasImage: Boolean(image) }),
        images: image ? [image] : undefined,
        maxOutputTokens: 2048,
      });
      return json({ draft });
    } catch (err) {
      if (!(err instanceof AIError)) throw err;
      return json({ error: "We couldn't read that prescription just now. Please try again." }, 502);
    }
  });
}
