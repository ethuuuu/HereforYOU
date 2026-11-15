import { authorizeTrigger } from "@/lib/auth/triggers";
import { handle, json } from "@/lib/http";
import { runAllReminders } from "@/lib/reminders/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Runs every circle's reminders. Only signed QStash calls or Vercel cron may trigger it. */
async function run(req: Request, body: string): Promise<Response> {
  return handle(async () => {
    if (!(await authorizeTrigger(req, body))) return json({ error: "Not authorised." }, 401);
    return json(await runAllReminders()); // counts only — never addresses
  });
}

/** Upstash QStash schedule (every 5 minutes). The signature covers the raw body. */
export async function POST(req: Request) {
  return run(req, await req.text());
}

/** Vercel cron (daily backup), authorised with `Authorization: Bearer CRON_SECRET`. */
export async function GET(req: Request) {
  return run(req, "");
}
