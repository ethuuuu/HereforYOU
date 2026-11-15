import { AIError, generateJSON } from "@/lib/ai/gemini";
import { prescriptionPrompt, PrescriptionDraftSchema } from "@/lib/ai/prompts";
import { PrescriptionRequestSchema } from "@/lib/domain/schemas";
import { enforceRateLimit } from "@/lib/data/rateLimits";
import { json, readJson, withCircle } from "@/lib/http";

// A photo read can take a while on a cold start; don't let the platform cut it off early.
export const maxDuration = 60;

/**
 * POST /api/circles/[id]/ai/prescription — pasted text and/or a photo → a DRAFT list of medicines.
 * Nothing is saved here: the user edits and confirms each draft, which then goes through the normal medications route.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/circles/[id]/ai/prescription">) {
  const { id } = await ctx.params;
  return withCircle(req, id, "ai.use", async ({ user }) => {
    const { text, image } = await readJson(req, PrescriptionRequestSchema);
    await enforceRateLimit(`ai-prescription:${user.uid}`, 20);
    const started = performance.now();
    let ok = false;
    try {
      const draft = await generateJSON(PrescriptionDraftSchema, {
        ...prescriptionPrompt({ text, hasImage: Boolean(image) }),
        images: image ? [image] : undefined,
        maxOutputTokens: 800, // a few medicines as JSON fits easily; a lower cap returns sooner
        minimalThinking: true, // reading a list doesn't need reasoning time
      });
      ok = true;
      return json({ draft });
    } catch (err) {
      if (!(err instanceof AIError)) throw err;
      return json({ error: "We couldn't read that prescription just now. Please try again." }, 502);
    } finally {
      // Sizes and timing only — never the photo or the prescription text.
      console.info("[ai/prescription]", {
        imageKB: image ? Math.round((image.base64.length * 3) / 4 / 1024) : 0,
        textChars: text?.length ?? 0,
        modelMs: Math.round(performance.now() - started),
        ok,
      });
    }
  });
}
