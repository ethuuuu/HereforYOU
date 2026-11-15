import { json, withCircle } from "@/lib/http";
import { runRemindersForCircle } from "@/lib/reminders/runner";

export const maxDuration = 60;

/** "Send reminders now" for one circle — same logic as the scheduled run. Elder, organiser or caretaker. */
export async function POST(req: Request, ctx: RouteContext<"/api/circles/[id]/reminders/run-now">) {
  const { id } = await ctx.params;
  return withCircle(req, id, "reminders.run", async () => {
    const { sent, failed } = await runRemindersForCircle(id);
    return json({ sent, failed });
  });
}
