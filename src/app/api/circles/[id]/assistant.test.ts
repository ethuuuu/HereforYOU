/**
 * F8 assistant routes: Gemini function calling (mocked), the confirm-before-acting flow,
 * per-tool permissions, argument validation, email recipients and voice transcription.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolCall } from "@/lib/ai/gemini";
import type { Circle } from "@/lib/domain/schemas";
import { localDateOf } from "@/lib/domain/time";
import { med, member, TZ } from "@/test/fixtures";

vi.mock("@/lib/auth/session", () => {
  class UnauthorizedError extends Error {}
  return { requireUser: vi.fn(), UnauthorizedError };
});
vi.mock("@/lib/ai/gemini", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/gemini")>()),
  chatWithTools: vi.fn(),
  transcribeAudio: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ serverEnv: () => ({ APP_URL: "https://app.test" }) }));
vi.mock("@/lib/data/members", () => ({ getMember: vi.fn(), listMembers: vi.fn() }));
vi.mock("@/lib/data/circles", () => ({ getCircle: vi.fn() }));
vi.mock("@/lib/data/medications", () => ({ getMedication: vi.fn(), listActiveMedications: vi.fn() }));
vi.mock("@/lib/data/doseLogs", () => ({ listDoseLogs: vi.fn(), logDose: vi.fn() }));
vi.mock("@/lib/data/appointments", () => ({ createAppointment: vi.fn(), listAppointmentsBetween: vi.fn() }));
vi.mock("@/lib/data/tasks", () => ({ createTask: vi.fn() }));
vi.mock("@/lib/data/rateLimits", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/data/activity", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/email/mailer", () => ({ sendEmail: vi.fn() }));

const { requireUser } = await import("@/lib/auth/session");
const { chatWithTools, transcribeAudio, AIError } = await import("@/lib/ai/gemini");
const { getMember, listMembers } = await import("@/lib/data/members");
const { getCircle } = await import("@/lib/data/circles");
const { getMedication, listActiveMedications } = await import("@/lib/data/medications");
const { listDoseLogs, logDose } = await import("@/lib/data/doseLogs");
const { createAppointment } = await import("@/lib/data/appointments");
const { createTask } = await import("@/lib/data/tasks");
const { logActivity } = await import("@/lib/data/activity");
const { sendEmail } = await import("@/lib/email/mailer");
const { enforceRateLimit } = await import("@/lib/data/rateLimits");
const { HttpError } = await import("@/lib/http");
const { POST } = await import("@/app/api/circles/[id]/assistant/route");
const { POST: transcribe } = await import("@/app/api/circles/[id]/assistant/transcribe/route");

const post = (body: unknown) =>
  new Request("http://test/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const ctx = { params: Promise.resolve({ id: "c1" }) };
const ask = (text: string) => POST(post({ messages: [{ role: "user", text }] }), ctx);
const today = localDateOf(new Date(), TZ);
const doseId = `med1_${today}_0800`;
const visit = { doctorName: "Dr. Rao", date: "2026-12-01", time: "10:00", location: "City Clinic" };
const people = [member("elder"), member("family", { name: "Priya" }), member("caretaker", { name: "Ravi", email: undefined })];

/** Makes the mocked model call one tool, recording what our handler answered. */
function modelCalls(call: ToolCall, text = "") {
  const answers: (Record<string, unknown> | null)[] = [];
  vi.mocked(chatWithTools).mockImplementation(async (opts) => {
    const out = await opts.onToolCall(call);
    answers.push(out);
    return out === null ? { text, stoppedAt: call } : { text: "Here you go." };
  });
  return answers;
}

beforeEach(() => {
  vi.mocked(requireUser).mockResolvedValue({ uid: "u-elder", name: "Asha" });
  vi.mocked(getMember).mockResolvedValue(member("elder"));
  vi.mocked(getCircle).mockResolvedValue({ id: "c1", elderName: "Asha", timezone: TZ, active: true } as Circle);
  vi.mocked(getMedication).mockResolvedValue(med());
  vi.mocked(listActiveMedications).mockResolvedValue([med()]);
  vi.mocked(listDoseLogs).mockResolvedValue([]);
  vi.mocked(listMembers).mockResolvedValue(people);
  vi.mocked(logDose).mockResolvedValue({});
  vi.mocked(createAppointment).mockResolvedValue("appt9");
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/circles/[id]/assistant — chat", () => {
  it("returns the model's text reply, with the person's words fenced and only allowed tools offered", async () => {
    vi.mocked(chatWithTools).mockResolvedValue({ text: "Hello Asha." });
    const res = await ask("Hello");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: "Hello Asha." });
    const opts = vi.mocked(chatWithTools).mock.calls[0][0];
    expect(opts.history[0].text).toContain("<user_input");
    expect(opts.system).toMatch(/never diagnose/i);
    expect(opts.system).not.toMatch(/@example\.com|u-elder/);
    expect(opts.tools.map((t) => t.name)).toContain("send_email");
  });

  it("runs read-only tools immediately and never leaks emails or uids", async () => {
    const answers = modelCalls({ name: "get_people", args: {} });
    await ask("Who is in my circle?");
    expect(answers[0]).toEqual({
      people: [
        { name: "Priya", role: "family", hasEmail: true },
        { name: "Ravi", role: "caretaker", hasEmail: false },
      ],
    });
    expect(JSON.stringify(answers)).not.toMatch(/@|u-family/);
  });

  it("turns an action into a pending confirmation and does NOT execute it", async () => {
    modelCalls({ name: "log_dose", args: { doseId, status: "taken" } }, "Shall I mark it?");
    const res = await ask("I took my Metformin");
    const body = await res.json();
    expect(body.reply).toBe("Shall I mark it?");
    expect(body.pending).toEqual({
      tool: "log_dose",
      args: { doseId, status: "taken" },
      summary: expect.stringMatching(/Mark Metformin 500 mg .* as taken\?/),
    });
    expect(logDose).not.toHaveBeenCalled();
  });

  it("rejects invalid tool arguments back to the model, with no pending action", async () => {
    const answers = modelCalls({ name: "schedule_visit", args: { doctorName: "Dr. Rao", date: "next Monday", time: "10" } });
    const body = await (await ask("Book Dr Rao")).json();
    expect(answers[0]).toMatchObject({ error: expect.stringContaining("Invalid arguments") });
    expect(body.pending).toBeUndefined();
    expect(createAppointment).not.toHaveBeenCalled();
  });

  it("ignores unknown tools and tools the role may not use", async () => {
    vi.mocked(getMember).mockResolvedValue(member("doctor"));
    const answers = modelCalls({ name: "send_email", args: { to: ["Priya"], subject: "Hi", message: "Hello" } });
    const body = await (await ask("Email Priya")).json();
    expect(answers[0]).toEqual({ error: "That tool isn't available." });
    expect(body.pending).toBeUndefined();
    expect(vi.mocked(chatWithTools).mock.calls[0][0].tools.map((t) => t.name)).not.toContain("send_email");
  });

  it("explains an unknown recipient to the model instead of guessing", async () => {
    const answers = modelCalls({ name: "send_email", args: { to: ["Bob"], subject: "Hi", message: "Hello" } });
    await ask("Email Bob");
    expect(answers[0]).toEqual({ error: expect.stringContaining('No one called "Bob"') });
  });

  it.each([
    ["an empty conversation", { messages: [] }],
    ["a last turn from the model", { messages: [{ role: "model", text: "hi" }] }],
    ["a message over 1,000 characters", { messages: [{ role: "user", text: "x".repeat(1001) }] }],
    ["more than 12 turns", { messages: Array.from({ length: 13 }, () => ({ role: "user", text: "hi" })) }],
  ])("rejects %s (400) without calling Gemini", async (_, body) => {
    expect((await POST(post(body), ctx)).status).toBe(400);
    expect(chatWithTools).not.toHaveBeenCalled();
  });

  it("forbids family members, who can't use AI (403)", async () => {
    vi.mocked(getMember).mockResolvedValue(member("family"));
    expect((await ask("hi")).status).toBe(403);
  });

  it("maps a Gemini failure to 502 without details", async () => {
    vi.mocked(chatWithTools).mockRejectedValue(new AIError("Gemini request failed: secret"));
    const res = await ask("hi");
    expect(res.status).toBe(502);
    expect((await res.json()).error).not.toContain("secret");
  });
});

describe("POST /api/circles/[id]/assistant — confirm", () => {
  const confirm = (tool: string, args: Record<string, unknown>) => POST(post({ confirm: { tool, args } }), ctx);

  it("logs the dose only after confirmation", async () => {
    const res = await confirm("log_dose", { doseId, status: "taken" });
    expect(res.status).toBe(200);
    expect((await res.json()).reply).toMatch(/Metformin is marked as taken/);
    expect(logDose).toHaveBeenCalledWith("c1", expect.objectContaining({ id: "u-elder" }), expect.objectContaining({ doseId }), "taken");
  });

  it("schedules a visit in the circle's time zone and returns a Google Calendar link", async () => {
    const res = await confirm("schedule_visit", visit);
    const body = await res.json();
    expect(createAppointment).toHaveBeenCalledWith(
      "c1",
      expect.anything(),
      expect.objectContaining({ doctorName: "Dr. Rao", durationMinutes: 30 }),
      "2026-12-01T04:30:00.000Z", // 10:00 in Asia/Kolkata
    );
    expect(body.link.href).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/);
  });

  it("adds a task", async () => {
    const res = await confirm("create_task", { title: "Call the pharmacy", date: today, time: "15:00" });
    expect(res.status).toBe(200);
    expect(createTask).toHaveBeenCalledWith("c1", expect.anything(), { title: "Call the pharmacy", date: today, time: "15:00" });
  });

  it("re-checks permission: a doctor can't log doses (403)", async () => {
    vi.mocked(getMember).mockResolvedValue(member("doctor"));
    expect((await confirm("log_dose", { doseId, status: "taken" })).status).toBe(403);
    expect(logDose).not.toHaveBeenCalled();
  });

  it("re-validates arguments (400) and refuses read-only or unknown tools", async () => {
    expect((await confirm("schedule_visit", { ...visit, time: "25:99" })).status).toBe(400);
    expect((await confirm("get_people", {})).status).toBe(400);
    expect((await confirm("delete_everything", {})).status).toBe(400);
    expect(createAppointment).not.toHaveBeenCalled();
  });

  it("rejects a dose that isn't loggable (old date)", async () => {
    expect((await confirm("log_dose", { doseId: "med1_2020-01-01_0800", status: "taken" })).status).toBe(400);
    expect(logDose).not.toHaveBeenCalled();
  });

  it("emails members chosen by name or role, server-side, with HTML escaped, and logs activity", async () => {
    const res = await confirm("send_email", { to: ["priya", "caretaker"], subject: "Hello", message: "<b>Feeling well</b>" });
    expect(res.status).toBe(200);
    // Ravi (caretaker) has no email, so only Priya gets it.
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [to, content] = vi.mocked(sendEmail).mock.calls[0];
    expect(to).toBe("family@example.com");
    expect(content.html).toContain("&lt;b&gt;Feeling well&lt;/b&gt;");
    expect(content.html).not.toContain("<b>Feeling");
    expect(logActivity).toHaveBeenCalledWith("c1", expect.objectContaining({ action: "assistant.email" }));
  });

  it("never emails the sender or someone outside the circle", async () => {
    const res = await confirm("send_email", { to: ["stranger@evil.test"], subject: "x", message: "y" });
    expect(res.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("reports 502 when every email fails", async () => {
    vi.mocked(sendEmail).mockRejectedValue(new Error("smtp down"));
    expect((await confirm("send_email", { to: ["Priya"], subject: "x", message: "y" })).status).toBe(502);
    expect(logActivity).not.toHaveBeenCalled();
  });
});

describe("assistant rate limits", () => {
  it("answers 429 without calling Gemini once the hourly message limit is used up", async () => {
    vi.mocked(enforceRateLimit).mockRejectedValueOnce(new HttpError(429, "slow down"));
    const res = await ask("hello");
    expect(res.status).toBe(429);
    expect(chatWithTools).not.toHaveBeenCalled();
  });

  it("applies a tighter, separate limit to confirmed emails", async () => {
    await POST(post({ confirm: { tool: "send_email", args: { to: ["Priya"], subject: "Hi", message: "Hello" } } }), ctx);
    expect(enforceRateLimit).toHaveBeenCalledWith("assistant-email:u-elder", 10);
  });
});

describe("POST /api/circles/[id]/assistant/transcribe", () => {
  const audio = Buffer.from("fake opus audio").toString("base64");

  it("returns Gemini's transcript", async () => {
    vi.mocked(transcribeAudio).mockResolvedValue("I took my tablets");
    const res = await transcribe(post({ mimeType: "audio/webm", base64: audio }), ctx);
    expect(await res.json()).toEqual({ text: "I took my tablets" });
  });

  it.each([
    ["a non-audio type", { mimeType: "image/png", base64: audio }],
    ["a recording over 2 MB", { mimeType: "audio/webm", base64: "A".repeat(3_000_000) }],
    ["data that isn't base64", { mimeType: "audio/webm", base64: "not base64!" }],
  ])("rejects %s (400)", async (_, body) => {
    expect((await transcribe(post(body), ctx)).status).toBe(400);
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it("maps a Gemini failure to 502", async () => {
    vi.mocked(transcribeAudio).mockRejectedValue(new AIError("x"));
    expect((await transcribe(post({ mimeType: "audio/ogg", base64: audio }), ctx)).status).toBe(502);
  });
});
