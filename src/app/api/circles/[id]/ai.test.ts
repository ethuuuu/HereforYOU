/**
 * F6 route tests: Gemini prescription drafts and visit questions. Gemini and data are mocked — no network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Circle } from "@/lib/domain/schemas";
import { appointment, med, member, TZ } from "@/test/fixtures";

vi.mock("@/lib/auth/session", () => {
  class UnauthorizedError extends Error {}
  return { requireUser: vi.fn(), UnauthorizedError };
});
vi.mock("@/lib/ai/gemini", () => {
  class AIError extends Error {}
  return { generateJSON: vi.fn(), AIError };
});
vi.mock("@/lib/data/rateLimits", () => ({ enforceRateLimit: vi.fn(), clientIp: () => "203.0.113.7" }));
vi.mock("@/lib/data/members", () => ({ getMember: vi.fn() }));
vi.mock("@/lib/data/circles", () => ({ getCircle: vi.fn() }));
vi.mock("@/lib/data/medications", () => ({ listActiveMedications: vi.fn() }));
vi.mock("@/lib/data/doseLogs", () => ({ listDoseLogs: vi.fn() }));
vi.mock("@/lib/data/appointments", () => ({ getAppointment: vi.fn(), setAppointmentQuestions: vi.fn() }));

const { requireUser } = await import("@/lib/auth/session");
const { generateJSON, AIError } = await import("@/lib/ai/gemini");
const { getMember } = await import("@/lib/data/members");
const { getCircle } = await import("@/lib/data/circles");
const { listActiveMedications } = await import("@/lib/data/medications");
const { listDoseLogs } = await import("@/lib/data/doseLogs");
const { getAppointment, setAppointmentQuestions } = await import("@/lib/data/appointments");
const { POST: readRx } = await import("@/app/api/circles/[id]/ai/prescription/route");
const { POST: suggest, PUT: saveQuestions } = await import("@/app/api/circles/[id]/appointments/[apptId]/questions/route");

const req = (method: string, body?: unknown) =>
  new Request("http://test/api", {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
  });
const ctx = { params: Promise.resolve({ id: "c1" }) };
const apptCtx = { params: Promise.resolve({ id: "c1", apptId: "appt1" }) };
const draft = { medications: [{ name: "Metformin", dose: "500 mg", times: ["08:00", "20:00"] }], uncertain: [] };
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]).toString("base64");

beforeEach(() => {
  vi.mocked(requireUser).mockResolvedValue({ uid: "u-elder", name: "Asha" });
  vi.mocked(getMember).mockResolvedValue(member("elder"));
  vi.mocked(getCircle).mockResolvedValue({ timezone: TZ, active: true } as Circle);
  vi.mocked(getAppointment).mockResolvedValue(appointment({ reason: "check-up" }));
  vi.mocked(listActiveMedications).mockResolvedValue([med()]);
  vi.mocked(listDoseLogs).mockResolvedValue([]);
  vi.mocked(setAppointmentQuestions).mockResolvedValue(true);
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/circles/[id]/ai/prescription", () => {
  it("returns Gemini's draft for pasted text (200) and saves nothing", async () => {
    vi.mocked(generateJSON).mockResolvedValue(draft);
    const res = await readRx(req("POST", { text: "Metformin 500mg 1-0-1" }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ draft });
    const opts = vi.mocked(generateJSON).mock.calls[0][1];
    expect(opts.prompt).toContain("<user_input");
    expect(opts.images).toBeUndefined();
  });

  it("passes a valid photo to Gemini", async () => {
    vi.mocked(generateJSON).mockResolvedValue(draft);
    const res = await readRx(req("POST", { image: { mimeType: "image/jpeg", base64: jpeg } }), ctx);
    expect(res.status).toBe(200);
    expect(vi.mocked(generateJSON).mock.calls[0][1].images).toEqual([{ mimeType: "image/jpeg", base64: jpeg }]);
  });

  it.each([
    ["nothing sent", {}],
    ["text too long", { text: "x".repeat(4001) }],
    ["wrong image type", { image: { mimeType: "image/gif", base64: jpeg } }],
    ["bytes aren't the claimed type", { image: { mimeType: "image/png", base64: jpeg } }],
    ["image over 4 MB", { image: { mimeType: "image/jpeg", base64: "/9j/" + "A".repeat(5_600_000) } }],
  ])("rejects %s (400) without calling Gemini", async (_, body) => {
    const res = await readRx(req("POST", body), ctx);
    expect(res.status).toBe(400);
    expect(generateJSON).not.toHaveBeenCalled();
  });

  it("maps a Gemini failure to 502 with a friendly message", async () => {
    vi.mocked(generateJSON).mockRejectedValue(new AIError("Gemini request failed: secret detail"));
    const res = await readRx(req("POST", { text: "Metformin" }), ctx);
    expect(res.status).toBe(502);
    expect((await res.json()).error).not.toContain("secret");
  });

  it("forbids family members (403)", async () => {
    vi.mocked(getMember).mockResolvedValue(member("family"));
    const res = await readRx(req("POST", { text: "Metformin" }), ctx);
    expect(res.status).toBe(403);
    expect(generateJSON).not.toHaveBeenCalled();
  });
});

describe("POST /api/circles/[id]/appointments/[apptId]/questions", () => {
  const questions = ["Should I keep taking Metformin?", "Can I take it before food?", "What should I do if I miss a dose?"];

  it("suggests questions from the visit and adherence, without personal details, and saves nothing", async () => {
    vi.mocked(generateJSON).mockResolvedValue({ questions });
    const res = await suggest(req("POST"), apptCtx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ questions });
    const { prompt } = vi.mocked(generateJSON).mock.calls[0][1];
    expect(prompt).toContain("Metformin 500 mg");
    expect(prompt).toContain("check-up");
    expect(prompt).not.toMatch(/u-elder|@example\.com|Dr\. Rao/);
    expect(setAppointmentQuestions).not.toHaveBeenCalled();
  });

  it("404s an unknown appointment", async () => {
    vi.mocked(getAppointment).mockResolvedValue(null);
    expect((await suggest(req("POST"), apptCtx)).status).toBe(404);
  });

  it("maps a Gemini failure to 502", async () => {
    vi.mocked(generateJSON).mockRejectedValue(new AIError("boom"));
    expect((await suggest(req("POST"), apptCtx)).status).toBe(502);
  });

  it("forbids family members (403)", async () => {
    vi.mocked(getMember).mockResolvedValue(member("family"));
    expect((await suggest(req("POST"), apptCtx)).status).toBe(403);
  });
});

describe("PUT /api/circles/[id]/appointments/[apptId]/questions", () => {
  it("saves the confirmed questions with the actor", async () => {
    const res = await saveQuestions(req("PUT", { questions: ["Should I keep taking it?"] }), apptCtx);
    expect(res.status).toBe(200);
    const [circleId, actor, apptId, saved] = vi.mocked(setAppointmentQuestions).mock.calls[0];
    expect([circleId, actor.id, apptId, saved]).toEqual(["c1", "u-elder", "appt1", ["Should I keep taking it?"]]);
  });

  it("rejects too many or too long questions (400)", async () => {
    expect((await saveQuestions(req("PUT", { questions: Array(6).fill("q") }), apptCtx)).status).toBe(400);
    expect((await saveQuestions(req("PUT", { questions: ["x".repeat(141)] }), apptCtx)).status).toBe(400);
    expect(setAppointmentQuestions).not.toHaveBeenCalled();
  });

  it("forbids family members (403)", async () => {
    vi.mocked(getMember).mockResolvedValue(member("family"));
    expect((await saveQuestions(req("PUT", { questions: [] }), apptCtx)).status).toBe(403);
  });
});
