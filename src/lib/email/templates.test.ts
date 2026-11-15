import { describe, expect, it } from "vitest";
import { planReminders } from "@/lib/domain/reminders";
import { dosesForDate } from "@/lib/domain/schedule";
import { appointment, med, member, TZ } from "@/test/fixtures";
import { escapeHtml, renderReminder } from "./templates";

const ctx = { elderName: "Asha", timezone: TZ, appUrl: "https://here-for-you.vercel.app" };

function actionAt(nowIso: string, medName = "Metformin") {
  return planReminders({
    now: new Date(nowIso),
    localToday: "2026-11-15",
    doses: dosesForDate([med({ name: medName, times: ["08:00"] })], "2026-11-15", TZ),
    logs: [],
    appointments: [],
    medications: [],
    members: [member("elder"), member("caretaker")],
    alreadySent: new Set(),
  });
}

describe("renderReminder", () => {
  it("writes a clear upcoming-dose email with local time", () => {
    const email = renderReminder(actionAt("2026-11-15T02:20:00Z")[0], ctx);
    expect(email.subject).toBe("Time for Metformin at 8:00 am");
    expect(email.text).toContain("after food");
    expect(email.html).toContain('lang="en"');
  });

  it("names the elder in escalation emails", () => {
    const esc = actionAt("2026-11-15T03:40:00Z").find((a) => a.kind === "dose_escalation");
    expect(renderReminder(esc!, ctx).subject).toContain("Asha may have missed");
  });

  it("escapes HTML in user-provided names", () => {
    const email = renderReminder(actionAt("2026-11-15T02:20:00Z", "<script>x</script>")[0], ctx);
    expect(email.html).not.toContain("<script>");
  });

  it("includes suggested doctor questions in appointment emails", () => {
    const [a] = planReminders({
      now: new Date("2026-11-15T06:00:00Z"),
      localToday: "2026-11-15",
      doses: [],
      logs: [],
      appointments: [appointment({ questions: ["Is my dose right?"] })],
      medications: [],
      members: [member("elder")],
      alreadySent: new Set(),
    });
    expect(renderReminder(a, ctx).text).toContain("Is my dose right?");
  });
});

describe("escapeHtml", () => {
  it("escapes all special characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});
