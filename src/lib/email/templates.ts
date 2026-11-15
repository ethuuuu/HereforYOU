/**
 * Email content for every reminder kind. Pure functions (unit-tested).
 * Accessible by design: large text, high contrast, plain-text twin, one clear action.
 */
import type { ReminderAction } from "@/lib/domain/reminders";
import { formatLocalDate, formatLocalTime } from "@/lib/domain/time";

export type EmailContent = { subject: string; text: string; html: string };

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type Ctx = { elderName: string; timezone: string; appUrl: string };

function layout(title: string, lines: string[], ctx: Ctx): string {
  const body = lines.map((l) => `<p style="margin:0 0 16px">${escapeHtml(l)}</p>`).join("");
  return `<!doctype html><html lang="en"><body style="margin:0;background:#ffffff">
<main style="font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:1.5;color:#111111;max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:26px;margin:0 0 16px">${escapeHtml(title)}</h1>${body}
<p style="margin:24px 0"><a href="${escapeHtml(ctx.appUrl)}" style="display:inline-block;background:#0b5394;color:#ffffff;padding:14px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Open Here For YOU</a></p>
<p style="font-size:14px;color:#444444">You receive this because you are part of ${escapeHtml(ctx.elderName)}'s care circle on Here For YOU. Change what you receive in Settings.</p>
</main></body></html>`;
}

export function renderReminder(action: ReminderAction, ctx: Ctx): EmailContent {
  const { elderName, timezone } = ctx;
  let title = "";
  let lines: string[] = [];

  if (action.dose) {
    const when = formatLocalTime(action.dose.scheduledAt, timezone);
    const med = `${action.dose.medicationName} (${action.dose.dose})`;
    const how = action.dose.instructions ? ` — ${action.dose.instructions}` : "";
    if (action.kind === "dose_upcoming") {
      title = `Time for ${action.dose.medicationName} at ${when}`;
      lines = [`${med} is due at ${when}${how}.`, "Tap “I took it” in the app once you have taken it."];
    } else if (action.kind === "dose_missed") {
      title = `Did you take ${action.dose.medicationName}?`;
      lines = [`${med} was due at ${when} and hasn't been marked as taken yet.`, "If you've taken it, please mark it in the app."];
    } else {
      title = `${elderName} may have missed ${action.dose.medicationName}`;
      lines = [
        `${med}, due at ${when}, still isn't marked as taken after an hour.`,
        `You may want to check in with ${elderName}.`,
      ];
    }
  } else if (action.appointment) {
    const a = action.appointment;
    const start = new Date(a.startsAt);
    const when = `${formatLocalDate(start, timezone)} at ${formatLocalTime(start, timezone)}`;
    title =
      action.kind === "appointment_soon"
        ? `Appointment soon: ${a.doctorName} at ${formatLocalTime(start, timezone)}`
        : `Tomorrow: appointment with ${a.doctorName}`;
    lines = [
      `${elderName} sees ${a.doctorName}${a.specialty ? ` (${a.specialty})` : ""} on ${when}.`,
      ...(a.location ? [`Where: ${a.location}`] : []),
      ...(a.questions?.length ? [`Questions to ask: ${a.questions.join(" · ")}`] : []),
    ];
  } else if (action.medication) {
    title = `Refill soon: ${action.medication.name}`;
    lines = [
      `${elderName} has about ${action.daysLeft} day(s) of ${action.medication.name} left.`,
      "Please arrange a refill.",
    ];
  }

  const text = [title, "", ...lines, "", `Open Here For YOU: ${ctx.appUrl}`].join("\n");
  return { subject: title, text, html: layout(title, lines, ctx) };
}

/** A message one circle member writes to others (via the assistant). `layout` escapes all text. */
export function renderPersonalEmail(msg: { from: string; subject: string; message: string }, ctx: Ctx): EmailContent {
  const footer = `Sent by ${msg.from} from ${ctx.elderName}'s care circle on Here For YOU.`;
  const lines = [...msg.message.split(/\n+/).filter(Boolean), footer];
  return {
    subject: `${msg.subject} — from ${msg.from}`,
    text: [...lines, "", `Open Here For YOU: ${ctx.appUrl}`].join("\n\n"),
    html: layout(msg.subject, lines, ctx),
  };
}
