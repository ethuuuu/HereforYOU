/**
 * F5 routes: scheduled trigger (QStash / Vercel cron), run-now and notification prefs.
 * The runner and data layer are mocked; trigger auth is the real code.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { member } from "@/test/fixtures";

vi.mock("@/lib/auth/session", () => {
  class UnauthorizedError extends Error {}
  return { requireUser: vi.fn(), UnauthorizedError };
});
vi.mock("@/lib/data/members", () => ({ getMember: vi.fn(), updateNotifyPrefs: vi.fn() }));
vi.mock("@/lib/reminders/runner", () => ({ runAllReminders: vi.fn(), runRemindersForCircle: vi.fn() }));

const { requireUser } = await import("@/lib/auth/session");
const { getMember, updateNotifyPrefs } = await import("@/lib/data/members");
const { runAllReminders, runRemindersForCircle } = await import("@/lib/reminders/runner");
const { GET, POST } = await import("./route");
const { POST: runNow } = await import("@/app/api/circles/[id]/reminders/run-now/route");
const { PUT: putNotify } = await import("@/app/api/circles/[id]/notify/route");

const SECRET = "a-very-long-cron-secret-value";
const ctx = { params: Promise.resolve({ id: "c1" }) };
const post = (body?: unknown) =>
  new Request("http://test/api", {
    method: body === undefined ? "POST" : "PUT",
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
  });

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.mocked(runAllReminders).mockResolvedValue({ circles: 2, sent: 3, failed: 0 });
  vi.mocked(runRemindersForCircle).mockResolvedValue({ circles: 1, sent: 1, failed: 0 });
  vi.mocked(requireUser).mockResolvedValue({ uid: "u-elder", name: "Asha" });
  vi.mocked(getMember).mockResolvedValue(member("elder"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("/api/reminders/run", () => {
  it("rejects unsigned calls with 401 and runs nothing", async () => {
    expect((await POST(new Request("http://test/api", { method: "POST", body: "{}" }))).status).toBe(401);
    expect((await GET(new Request("http://test/api", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    expect(runAllReminders).not.toHaveBeenCalled();
  });

  it("runs for Vercel cron and returns counts only", async () => {
    const res = await GET(new Request("http://test/api", { headers: { authorization: `Bearer ${SECRET}` } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ circles: 2, sent: 3, failed: 0 });
  });
});

describe("POST /api/circles/[id]/reminders/run-now", () => {
  it.each(["elder", "organiser", "caretaker"] as const)("runs this circle for %s", async (role) => {
    vi.mocked(getMember).mockResolvedValue(member(role));
    const res = await runNow(post(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 1, failed: 0 });
    expect(runRemindersForCircle).toHaveBeenCalledWith("c1");
  });

  it.each(["family", "doctor"] as const)("forbids %s (403)", async (role) => {
    vi.mocked(getMember).mockResolvedValue(member(role));
    expect((await runNow(post(), ctx)).status).toBe(403);
    expect(runRemindersForCircle).not.toHaveBeenCalled();
  });
});

describe("PUT /api/circles/[id]/notify", () => {
  const prefs = { doseUpcoming: false, doseMissed: true, escalation: true, appointments: false, refills: true };

  it("saves the caller's own preferences", async () => {
    vi.mocked(getMember).mockResolvedValue(member("family"));
    const res = await putNotify(post(prefs), ctx);
    expect(res.status).toBe(200);
    expect(updateNotifyPrefs).toHaveBeenCalledWith("c1", expect.objectContaining({ id: "u-family" }), prefs);
  });

  it("rejects missing or extra fields (400)", async () => {
    expect((await putNotify(post({ doseMissed: true }), ctx)).status).toBe(400);
    expect((await putNotify(post({ ...prefs, memberId: "u-elder" }), ctx)).status).toBe(400);
    expect(updateNotifyPrefs).not.toHaveBeenCalled();
  });
});
