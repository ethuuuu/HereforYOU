/**
 * F5 runner: data layer and mailer mocked — no Firebase, no real email.
 * 9:00 AM in Kolkata, the 8:00 AM Metformin is unlogged → "missed" to the elder, "escalation" to support.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Circle } from "@/lib/domain/schemas";
import { med, member, TZ } from "@/test/fixtures";

vi.mock("@/lib/env", () => ({ serverEnv: () => ({ APP_URL: "https://app.test" }) }));
vi.mock("@/lib/email/mailer", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/data/circles", () => ({ getCircle: vi.fn(), listActiveCircles: vi.fn() }));
vi.mock("@/lib/data/members", () => ({ listMembers: vi.fn() }));
vi.mock("@/lib/data/medications", () => ({ listActiveMedications: vi.fn() }));
vi.mock("@/lib/data/doseLogs", () => ({ listDoseLogs: vi.fn() }));
vi.mock("@/lib/data/appointments", () => ({ listAppointmentsBetween: vi.fn() }));
vi.mock("@/lib/data/sentReminders", () => ({ listSentKeys: vi.fn(), recordSent: vi.fn() }));

const { sendEmail } = await import("@/lib/email/mailer");
const { getCircle, listActiveCircles } = await import("@/lib/data/circles");
const { listMembers } = await import("@/lib/data/members");
const { listActiveMedications } = await import("@/lib/data/medications");
const { listDoseLogs } = await import("@/lib/data/doseLogs");
const { listAppointmentsBetween } = await import("@/lib/data/appointments");
const { listSentKeys, recordSent } = await import("@/lib/data/sentReminders");
const { runAllReminders, runRemindersForCircle } = await import("./runner");

const NOW = new Date("2026-11-15T03:30:00Z");
const circle = (id = "c1") => ({ id, elderName: "Asha", timezone: TZ, active: true }) as Circle;
const MISSED = "dose_missed:med1_2026-11-15_0800";
const ESCALATION = "dose_escalation:med1_2026-11-15_0800";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getCircle).mockResolvedValue(circle());
  vi.mocked(listActiveCircles).mockResolvedValue([circle()]);
  vi.mocked(listMembers).mockResolvedValue([member("elder"), member("caretaker"), member("family")]);
  vi.mocked(listActiveMedications).mockResolvedValue([med()]);
  vi.mocked(listDoseLogs).mockResolvedValue([]);
  vi.mocked(listAppointmentsBetween).mockResolvedValue([]);
  vi.mocked(listSentKeys).mockResolvedValue(new Set());
  vi.mocked(sendEmail).mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("runRemindersForCircle", () => {
  it("sends each email and records each key after sending", async () => {
    expect(await runRemindersForCircle("c1", NOW)).toEqual({ circles: 1, sent: 3, failed: 0 });
    const to = vi.mocked(sendEmail).mock.calls.map(([addr]) => addr).sort();
    expect(to).toEqual(["caretaker@example.com", "elder@example.com", "family@example.com"]);
    expect(recordSent).toHaveBeenCalledWith("c1", MISSED, "dose_missed", 1);
    expect(recordSent).toHaveBeenCalledWith("c1", ESCALATION, "dose_escalation", 2);
  });

  it("skips reminders that were already sent", async () => {
    vi.mocked(listSentKeys).mockResolvedValue(new Set([MISSED, ESCALATION]));
    expect(await runRemindersForCircle("c1", NOW)).toEqual({ circles: 1, sent: 0, failed: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(recordSent).not.toHaveBeenCalled();
  });

  it("keeps going when one recipient fails, and counts the failure", async () => {
    vi.mocked(sendEmail).mockImplementation(async (to) => {
      if (to === "caretaker@example.com") throw new Error("smtp down");
    });
    expect(await runRemindersForCircle("c1", NOW)).toEqual({ circles: 1, sent: 2, failed: 1 });
    expect(recordSent).toHaveBeenCalledWith("c1", ESCALATION, "dose_escalation", 1);
    expect(recordSent).toHaveBeenCalledWith("c1", MISSED, "dose_missed", 1);
  });

  it("does not record a reminder when every send failed (so it is retried next run)", async () => {
    vi.mocked(sendEmail).mockRejectedValue(new Error("smtp down"));
    expect(await runRemindersForCircle("c1", NOW)).toEqual({ circles: 1, sent: 0, failed: 3 });
    expect(recordSent).not.toHaveBeenCalled();
  });

  it("sends nothing for a missing circle", async () => {
    vi.mocked(getCircle).mockResolvedValue(null);
    expect(await runRemindersForCircle("c1", NOW)).toEqual({ circles: 0, sent: 0, failed: 0 });
    expect(listMembers).not.toHaveBeenCalled();
  });

  it("stays within the read budget: one query per collection, narrowed windows", async () => {
    await runRemindersForCircle("c1", NOW);
    for (const fn of [listMembers, listActiveMedications, listDoseLogs, listAppointmentsBetween, listSentKeys]) {
      expect(fn).toHaveBeenCalledTimes(1);
    }
    // 9 AM: the 6 h lookback stays inside today, so only today's logs are read.
    expect(listDoseLogs).toHaveBeenCalledWith("c1", "2026-11-15", "2026-11-15");
    expect(listAppointmentsBetween).toHaveBeenCalledWith("c1", NOW.toISOString(), "2026-11-16T05:30:00.000Z");
    expect(listSentKeys).toHaveBeenCalledWith("c1", "2026-11-14T02:30:00.000Z");
  });
});

describe("runAllReminders", () => {
  it("lists circles once and never re-reads each circle doc", async () => {
    vi.mocked(listActiveCircles).mockResolvedValue([circle("c1"), circle("c2")]);
    expect(await runAllReminders(NOW)).toEqual({ circles: 2, sent: 6, failed: 0 });
    expect(listActiveCircles).toHaveBeenCalledTimes(1);
    expect(getCircle).not.toHaveBeenCalled();
    expect(listMembers).toHaveBeenCalledTimes(2);
  });

  it("one broken circle doesn't stop the others", async () => {
    vi.mocked(listActiveCircles).mockResolvedValue([circle("bad"), circle("c2")]);
    vi.mocked(listMembers).mockImplementation(async (id) => {
      if (id === "bad") throw new Error("firestore");
      return [member("elder")];
    });
    expect(await runAllReminders(NOW)).toEqual({ circles: 2, sent: 1, failed: 1 });
  });
});
