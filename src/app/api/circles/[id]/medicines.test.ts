/**
 * F3 route tests: medicines CRUD + dose logging. Data layer is mocked — no live Firebase.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Circle } from "@/lib/domain/schemas";
import { med, member, TZ } from "@/test/fixtures";

vi.mock("@/lib/auth/session", () => {
  class UnauthorizedError extends Error {}
  return { requireUser: vi.fn(), UnauthorizedError };
});
vi.mock("@/lib/data/members", () => ({ getMember: vi.fn() }));
vi.mock("@/lib/data/circles", () => ({ getCircle: vi.fn() }));
vi.mock("@/lib/data/medications", () => ({
  getMedication: vi.fn(),
  createMedication: vi.fn(),
  updateMedication: vi.fn(),
  stopMedication: vi.fn(),
}));
vi.mock("@/lib/data/doseLogs", () => ({ logDose: vi.fn() }));

const { requireUser } = await import("@/lib/auth/session");
const { getMember } = await import("@/lib/data/members");
const { getCircle } = await import("@/lib/data/circles");
const { getMedication, createMedication, updateMedication, stopMedication } = await import("@/lib/data/medications");
const { logDose } = await import("@/lib/data/doseLogs");
const { POST: dosePost } = await import("@/app/api/circles/[id]/doses/route");
const { POST: medPost } = await import("@/app/api/circles/[id]/medications/route");
const { PATCH: medPatch, DELETE: medDelete } = await import("@/app/api/circles/[id]/medications/[medId]/route");

const req = (method: string, body?: unknown) =>
  new Request("http://test/api", {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
  });
const ctx = { params: Promise.resolve({ id: "c1" }) };
const medCtx = { params: Promise.resolve({ id: "c1", medId: "med1" }) };
const circle = { timezone: TZ, active: true } as Circle;
const validMed = { name: "Metformin", dose: "500 mg", times: ["08:00"], startDate: "2026-11-01" };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-15T03:00:00Z")); // 8:30 AM in Kolkata
  vi.mocked(requireUser).mockResolvedValue({ uid: "u-elder", name: "Asha" });
  vi.mocked(getMember).mockResolvedValue(member("elder"));
  vi.mocked(getCircle).mockResolvedValue(circle);
  vi.mocked(getMedication).mockResolvedValue(med({ pillsRemaining: 30 }));
  vi.mocked(logDose).mockResolvedValue({ pillsRemaining: 29 });
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("POST /api/circles/[id]/doses", () => {
  it("logs the exact dose that was tapped", async () => {
    const res = await dosePost(req("POST", { doseId: "med1_2026-11-15_0800", status: "taken" }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, doseId: "med1_2026-11-15_0800", status: "taken", pillsRemaining: 29 });
    const [, actor, dose, status] = vi.mocked(logDose).mock.calls[0];
    expect(actor.id).toBe("u-elder");
    expect(dose).toMatchObject({ medicationId: "med1", localDate: "2026-11-15", localTime: "08:00" });
    expect(status).toBe("taken");
  });

  it("lets family confirm a dose", async () => {
    vi.mocked(getMember).mockResolvedValue(member("family"));
    const res = await dosePost(req("POST", { doseId: "med1_2026-11-15_2000", status: "skipped" }), ctx);
    expect(res.status).toBe(200);
  });

  it("forbids doctors (403)", async () => {
    vi.mocked(getMember).mockResolvedValue(member("doctor"));
    const res = await dosePost(req("POST", { doseId: "med1_2026-11-15_0800", status: "taken" }), ctx);
    expect(res.status).toBe(403);
    expect(logDose).not.toHaveBeenCalled();
  });

  it("404s a time the medicine isn't scheduled at", async () => {
    const res = await dosePost(req("POST", { doseId: "med1_2026-11-15_0900", status: "taken" }), ctx);
    expect(res.status).toBe(404);
    expect(logDose).not.toHaveBeenCalled();
  });

  it("404s an unknown medicine", async () => {
    vi.mocked(getMedication).mockResolvedValue(null);
    const res = await dosePost(req("POST", { doseId: "nope_2026-11-15_0800", status: "taken" }), ctx);
    expect(res.status).toBe(404);
  });

  it("rejects doses older than yesterday (400)", async () => {
    const res = await dosePost(req("POST", { doseId: "med1_2026-11-10_0800", status: "taken" }), ctx);
    expect(res.status).toBe(400);
    expect(logDose).not.toHaveBeenCalled();
  });

  it("rejects an invalid status (400)", async () => {
    const res = await dosePost(req("POST", { doseId: "med1_2026-11-15_0800", status: "eaten" }), ctx);
    expect(res.status).toBe(400);
  });

  it("404s non-members", async () => {
    vi.mocked(getMember).mockResolvedValue(null);
    const res = await dosePost(req("POST", { doseId: "med1_2026-11-15_0800", status: "taken" }), ctx);
    expect(res.status).toBe(404);
  });
});

describe("medicines routes", () => {
  it("adds a medicine with schema defaults (201)", async () => {
    vi.mocked(createMedication).mockResolvedValue("m9");
    const res = await medPost(req("POST", validMed), ctx);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "m9" });
    expect(vi.mocked(createMedication).mock.calls[0][2]).toMatchObject({ pillsPerDose: 1, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  });

  it("returns field errors for a bad medicine (400)", async () => {
    const res = await medPost(req("POST", { ...validMed, times: [] }), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).fields).toHaveProperty("times");
    expect(createMedication).not.toHaveBeenCalled();
  });

  it("forbids family from adding medicines (403)", async () => {
    vi.mocked(getMember).mockResolvedValue(member("family"));
    const res = await medPost(req("POST", validMed), ctx);
    expect(res.status).toBe(403);
  });

  it("forbids a caretaker the owner hasn't allowed from adding, editing or stopping medicines (403)", async () => {
    vi.mocked(getMember).mockResolvedValue(member("caretaker"));
    const res = await medPost(req("POST", validMed), ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Only people the circle owner has allowed can add or change medicines." });
    expect((await medPatch(req("PATCH", validMed), medCtx)).status).toBe(403);
    expect((await medDelete(req("DELETE"), medCtx)).status).toBe(403);
    expect(createMedication).not.toHaveBeenCalled();
    expect(updateMedication).not.toHaveBeenCalled();
    expect(stopMedication).not.toHaveBeenCalled();
  });

  it("lets an allowed caretaker add medicines", async () => {
    vi.mocked(getMember).mockResolvedValue(member("caretaker", { medsAuthorized: true }));
    vi.mocked(createMedication).mockResolvedValue("m9");
    expect((await medPost(req("POST", validMed), ctx)).status).toBe(201);
  });

  it("edits and stops a medicine", async () => {
    vi.mocked(updateMedication).mockResolvedValue(true);
    vi.mocked(stopMedication).mockResolvedValue(true);
    expect((await medPatch(req("PATCH", validMed), medCtx)).status).toBe(200);
    expect((await medDelete(req("DELETE"), medCtx)).status).toBe(200);
  });

  it("404s editing a medicine that doesn't exist", async () => {
    vi.mocked(updateMedication).mockResolvedValue(false);
    expect((await medPatch(req("PATCH", validMed), medCtx)).status).toBe(404);
  });
});
