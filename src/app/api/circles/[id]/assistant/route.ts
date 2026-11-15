import { z } from "zod";
import { AIError, chatWithTools } from "@/lib/ai/gemini";
import { assistantHistory, assistantSystemPrompt } from "@/lib/ai/prompts";
import { executeAction, handleModelCall, toolDeclarations, type Pending } from "@/lib/assistant/tools";
import { getCircle } from "@/lib/data/circles";
import { formatLocalDate, formatLocalTime, localDateOf } from "@/lib/domain/time";
import { enforceRateLimit } from "@/lib/data/rateLimits";
import { json, NotFoundError, readJson, withCircle } from "@/lib/http";

export const maxDuration = 60;

const Turn = z.object({ role: z.enum(["user", "model"]), text: z.string().trim().min(1).max(2000) });
const BodySchema = z.union([
  z.object({
    messages: z
      .array(Turn)
      .min(1)
      .max(12, "Conversation is too long")
      .refine((m) => m.at(-1)?.role === "user" && m.at(-1)!.text.length <= 1000, "Keep your message under 1,000 characters"),
  }),
  z.object({ confirm: z.object({ tool: z.string().max(40), args: z.record(z.string(), z.unknown()) }) }),
]);

/**
 * POST /api/circles/[id]/assistant
 * - `{ messages }` → Gemini (function calling) → `{ reply, pending? }`. Read-only tools run here;
 *   an action only comes back as `pending` for the person to confirm. Nothing is changed.
 * - `{ confirm: { tool, args } }` → the person said yes: re-validated, permission-checked, executed.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/circles/[id]/assistant">) {
  const { id } = await ctx.params;
  return withCircle(req, id, "ai.use", async ({ member }) => {
    const body = await readJson(req, BodySchema);
    // Every message is a paid Gemini call, and emails reach real inboxes: cap both per account.
    await enforceRateLimit(`ai-assistant:${member.id}`, 60);
    if ("confirm" in body && body.confirm.tool === "send_email") await enforceRateLimit(`assistant-email:${member.id}`, 10);
    const circle = await getCircle(id);
    if (!circle) throw new NotFoundError("Care circle");
    const toolCtx = { circle, member };

    if ("confirm" in body) return json(await executeAction(toolCtx, body.confirm.tool, body.confirm.args));

    const now = new Date();
    const system = assistantSystemPrompt({
      elderName: circle.elderName,
      userName: member.name,
      role: member.role,
      today: `${formatLocalDate(now, circle.timezone)} (${localDateOf(now, circle.timezone)})`,
      now: formatLocalTime(now, circle.timezone),
    });
    let pending: Pending | undefined;
    try {
      const { text } = await chatWithTools({
        system,
        history: assistantHistory(body.messages),
        tools: toolDeclarations(member),
        onToolCall: async (call) => {
          const result = await handleModelCall(toolCtx, call.name, call.args);
          if ("output" in result) return result.output;
          pending = result.pending;
          return null; // stop: the person must confirm first
        },
      });
      const reply = text || (pending ? "" : "Sorry, I didn't catch that. Could you say it another way?");
      return json({ reply, ...(pending ? { pending } : {}) });
    } catch (err) {
      if (!(err instanceof AIError)) throw err;
      console.warn("[assistant] model failed:", err.message.slice(0, 300));
      return json({ error: "The assistant isn't available right now. Please try again." }, 502);
    }
  });
}
