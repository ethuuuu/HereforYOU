import { describe, expect, it } from "vitest";
import { appointment, med, member, TZ } from "@/test/fixtures";
import { planReminders, type PlanInput } from "./reminders";
import { dosesForDate } from "./schedule";

const members = [member("elder"), member("caretaker"), member("family"), member("doctor")];
const doses = dosesForDate([med({ times: ["08:00"] })], "2026-11-15", TZ); // 02:30Z
const doseId = doses[0].doseId;

function plan(nowIso: string, overrides: Partial<PlanInput> = {}) {
  return planReminders({
    now: new Date(nowIso),
    localToday: "2026-11-15",
    doses,
    logs: [],
    appointments: [],
    medications: [],
    members,
    alreadySent: new Set(),
    ...overrides,
  });
}
const kinds = (actions: ReturnType<typeof plan>) => actions.map((a) => a.kind).sort();
const emails = (actions: ReturnType<typeof plan>, kind: string) =>
  actions.find((a) => a.kind === kind)?.recipients.map((r) => r.email).sort();

describe("dose escalation ladder", () => {
  it("sends nothing more than 15 minutes before", () => {
    expect(plan("2026-11-15T02:10:00Z")).toEqual([]);
  });

  it("sends 'upcoming' to the elder in the 15 minutes before", () => {
    const actions = plan("2026-11-15T02:20:00Z");
    expect(kinds(actions)).toEqual(["dose_upcoming"]);
    expect(emails(actions, "dose_upcoming")).toEqual(["elder@example.com"]);
  });

  it("sends nothing during the 30-minute grace period", () => {
    expect(plan("2026-11-15T02:45:00Z")).toEqual([]);
  });

  it("sends 'missed' to the elder after 30 minutes", () => {
    const actions = plan("2026-11-15T03:05:00Z");
    expect(kinds(actions)).toEqual(["dose_missed"]);
    expect(emails(actions, "dose_missed")).toEqual(["elder@example.com"]);
  });

  it("escalates to caretaker and family (not the doctor) after 60 minutes", () => {
    const actions = plan("2026-11-15T03:35:00Z", { alreadySent: new Set([`dose_missed:${doseId}`]) });
    expect(kinds(actions)).toEqual(["dose_escalation"]);
    expect(emails(actions, "dose_escalation")).toEqual(["caretaker@example.com", "family@example.com"]);
  });

  it("catches up on both missed + escalation if the runner was down", () => {
    expect(kinds(plan("2026-11-15T03:35:00Z"))).toEqual(["dose_escalation", "dose_missed"]);
  });

  it("stops once the dose is logged", () => {
    const logs = [{ doseId, medicationId: "med1", localDate: "2026-11-15", status: "taken" as const, loggedBy: "u-elder", loggedAt: "" }];
    expect(plan("2026-11-15T03:35:00Z", { logs })).toEqual([]);
  });

  it("never repeats a reminder that was already sent", () => {
    expect(plan("2026-11-15T02:20:00Z", { alreadySent: new Set([`dose_upcoming:${doseId}`]) })).toEqual([]);
  });

  it("ignores doses older than the lookback window", () => {
    expect(plan("2026-11-15T10:00:00Z")).toEqual([]);
  });

  it("skips members without email or who opted out", () => {
    const quiet = [member("elder", { email: undefined }), member("caretaker")];
    expect(plan("2026-11-15T02:20:00Z", { members: quiet })).toEqual([]);
  });
});

describe("appointments", () => {
  const appt = appointment(); // 2026-11-16T04:30Z
  it("reminds everyone opted-in the day before", () => {
    const actions = plan("2026-11-15T06:00:00Z", { appointments: [appt], doses: [] });
    expect(kinds(actions)).toEqual(["appointment_day_before"]);
    expect(emails(actions, "appointment_day_before")).toEqual([
      "caretaker@example.com",
      "elder@example.com",
      "family@example.com",
    ]);
  });
  it("sends a 'soon' reminder within 2 hours", () => {
    expect(kinds(plan("2026-11-16T03:00:00Z", { appointments: [appt], doses: [] }))).toEqual(["appointment_soon"]);
  });
  it("ignores past appointments", () => {
    expect(plan("2026-11-16T05:00:00Z", { appointments: [appt], doses: [] })).toEqual([]);
  });
});

describe("refills", () => {
  it("warns once per day when supply is low", () => {
    const low = med({ pillsRemaining: 6 }); // 3 days at 2/day
    const actions = plan("2026-11-15T06:00:00Z", { medications: [low], doses: [] });
    expect(actions[0]).toMatchObject({ kind: "refill_low", key: "refill_low:med1:2026-11-15", daysLeft: 3 });
  });
  it("stays quiet when supply is fine or untracked", () => {
    expect(plan("2026-11-15T06:00:00Z", { medications: [med({ pillsRemaining: 100 })], doses: [] })).toEqual([]);
    expect(plan("2026-11-15T06:00:00Z", { medications: [med()], doses: [] })).toEqual([]);
  });
});
