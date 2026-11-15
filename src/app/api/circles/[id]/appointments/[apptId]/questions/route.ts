import { AIError, generateJSON } from "@/lib/ai/gemini";
import { visitQuestionsPrompt, VisitQuestionsSchema } from "@/lib/ai/prompts";
import { getAppointment, setAppointmentQuestions } from "@/lib/data/appointments";
import { getCircle } from "@/lib/data/circles";
import { listDoseLogs } from "@/lib/data/doseLogs";
import { listActiveMedications } from "@/lib/data/medications";
import { summarizeAdherence } from "@/lib/domain/adherence";
import { dosesForRange } from "@/lib/domain/schedule";
import { SaveQuestionsSchema } from "@/lib/domain/schemas";
import { addDays, localDateOf } from "@/lib/domain/time";
import { enforceRateLimit } from "@/lib/data/rateLimits";
import { isSafeId, json, NotFoundError, readJson, withCircle } from "@/lib/http";

type Ctx = RouteContext<"/api/circles/[id]/appointments/[apptId]/questions">;
const DAYS = 30;

/** POST — suggest questions for a visit. Returns them only; nothing is saved until PUT. */
export async function POST(req: Request, ctx: Ctx) {
  const { id, apptId } = await ctx.params;
  return withCircle(req, id, "ai.use", async ({ user }) => {
    await enforceRateLimit(`ai-questions:${user.uid}`, 20);
    if (!isSafeId(apptId)) throw new NotFoundError("That appointment");
    const [appt, circle] = await Promise.all([getAppointment(id, apptId), getCircle(id)]);
    if (!appt || !circle) throw new NotFoundError("That appointment");
    const now = new Date();
    const today = localDateOf(now, circle.timezone);
    const from = addDays(today, -(DAYS - 1));
    const [meds, logs] = await Promise.all([listActiveMedications(id), listDoseLogs(id, from, today)]);
    const summary = summarizeAdherence(dosesForRange(meds, from, today, circle.timezone), logs, now);
    // Only what the model needs: no names of people, emails or ids.
    const prompt = visitQuestionsPrompt({
      specialty: appt.specialty,
      reason: appt.reason,
      notes: appt.notes,
      medicines: meds.map((m) => `${m.name} ${m.dose}`),
      adherence: { taken: summary.taken, missed: summary.missed, skipped: summary.skipped, days: DAYS },
    });
    try {
      const { questions } = await generateJSON(VisitQuestionsSchema, prompt);
      return json({ questions });
    } catch (err) {
      if (!(err instanceof AIError)) throw err;
      return json({ error: "We couldn't suggest questions just now. Please try again." }, 502);
    }
  });
}

/** PUT — save the questions the user picked (and maybe edited). */
export async function PUT(req: Request, ctx: Ctx) {
  const { id, apptId } = await ctx.params;
  return withCircle(req, id, "appointments.edit", async ({ member }) => {
    if (!isSafeId(apptId)) throw new NotFoundError("That appointment");
    const { questions } = await readJson(req, SaveQuestionsSchema);
    if (!(await setAppointmentQuestions(id, member, apptId, questions))) throw new NotFoundError("That appointment");
    return json({ ok: true });
  });
}
