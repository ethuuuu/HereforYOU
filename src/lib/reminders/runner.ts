/**
 * Reminder runner: loads what the planner needs for a circle, sends each email,
 * and records the reminder key only after a successful send (idempotent re-runs).
 *
 * Read budget per circle per run (AGENTS.md §9): members + active medicines +
 * dose logs since the lookback window + appointments in the next 26 h + reminder
 * keys sent in the last 25 h. Typically ~20–30 document reads.
 */
import "server-only";
import { getCircle, listActiveCircles } from "@/lib/data/circles";
import { listAppointmentsBetween } from "@/lib/data/appointments";
import { listDoseLogs } from "@/lib/data/doseLogs";
import { listActiveMedications } from "@/lib/data/medications";
import { listMembers } from "@/lib/data/members";
import { listSentKeys, recordSent } from "@/lib/data/sentReminders";
import { LOOKBACK_HOURS, planReminders } from "@/lib/domain/reminders";
import { dosesForRange } from "@/lib/domain/schedule";
import type { Circle } from "@/lib/domain/schemas";
import { HOUR, localDateOf } from "@/lib/domain/time";
import { sendEmail } from "@/lib/email/mailer";
import { renderReminder } from "@/lib/email/templates";
import { serverEnv } from "@/lib/env";

export type RunResult = { circles: number; sent: number; failed: number };

const APPOINTMENT_WINDOW_HOURS = 26;
// Longest-lived key the planner can see again: "day before" sent ~24 h ahead (25 h for slack).
const SENT_WINDOW_HOURS = 25;

async function runForCircle(circle: Circle, now: Date): Promise<RunResult> {
  const tz = circle.timezone;
  const today = localDateOf(now, tz);
  // Only doses inside the planner's lookback can trigger anything, so start there (usually today).
  const fromDate = localDateOf(new Date(now.getTime() - LOOKBACK_HOURS * HOUR), tz);
  const [members, medications, logs, appointments, alreadySent] = await Promise.all([
    listMembers(circle.id),
    listActiveMedications(circle.id),
    listDoseLogs(circle.id, fromDate, today),
    listAppointmentsBetween(
      circle.id,
      now.toISOString(),
      new Date(now.getTime() + APPOINTMENT_WINDOW_HOURS * HOUR).toISOString(),
    ),
    listSentKeys(circle.id, new Date(now.getTime() - SENT_WINDOW_HOURS * HOUR).toISOString()),
  ]);

  const actions = planReminders({
    now,
    localToday: today,
    doses: dosesForRange(medications, fromDate, today, tz),
    logs,
    appointments,
    medications,
    members,
    alreadySent,
  });

  const ctx = { elderName: circle.elderName, timezone: tz, appUrl: serverEnv().APP_URL };
  let sent = 0;
  let failed = 0;
  for (const action of actions) {
    const content = renderReminder(action, ctx);
    const results = await Promise.allSettled(action.recipients.map((r) => sendEmail(r.email, content)));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    sent += ok;
    failed += results.length - ok;
    if (ok > 0) await recordSent(circle.id, action.key, action.kind, ok);
    // Log the kind only — never recipient addresses.
    if (ok < results.length) console.error(`[reminders] ${results.length - ok} ${action.kind} email(s) failed`);
  }
  return { circles: 1, sent, failed };
}

/** One circle (for "Send reminders now"). Inactive or missing circles send nothing. */
export async function runRemindersForCircle(circleId: string, now = new Date()): Promise<RunResult> {
  const circle = await getCircle(circleId);
  if (!circle?.active) return { circles: 0, sent: 0, failed: 0 };
  return runForCircle(circle, now);
}

/** Every active circle. One circle's failure never stops the others. */
export async function runAllReminders(now = new Date()): Promise<RunResult> {
  const circles = await listActiveCircles();
  const results = await Promise.allSettled(circles.map((c) => runForCircle(c, now)));
  const total: RunResult = { circles: circles.length, sent: 0, failed: 0 };
  for (const r of results) {
    if (r.status === "fulfilled") {
      total.sent += r.value.sent;
      total.failed += r.value.failed;
    } else {
      total.failed += 1;
      console.error("[reminders] a circle failed to run", r.reason instanceof Error ? r.reason.name : "error");
    }
  }
  return total;
}
