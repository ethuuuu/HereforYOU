/**
 * F4 route tests: appointments CRUD. Data layer is mocked — no live Firebase.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Circle } from "@/lib/domain/schemas";
import { member, TZ } from "@/test/fixtures";

vi.mock("@/lib/auth/session", () => {
  class UnauthorizedError extends Error {}
  return { requireUser: vi.fn(), UnauthorizedError };
});
vi.mock("@/lib/data/members", () => ({ getMember: vi.fn() }));
vi.mock("@/lib/data/circles", () => ({ getCircle: vi.fn() }));
vi.mock("@/lib/data/appointments", () => ({
  createAppointment: vi.fn(),
  updateAppointment: vi.fn(),
  deleteAppointment: vi.fn(),
}));

const { requireUser } = await import("@/lib/auth/session");
const { getMember } = await import("@/lib/data/members");
const { getCircle } = await import("@/lib/data/circles");
const { createAppointment, updateAppointment, deleteAppointment } = await import("@/lib/data/appointments");
const { POST } = await import("@/app/api/circles/[id]/appointments/route");
const { PATCH, DELETE } = await import("@/app/api/circles/[id]/appointments/[apptId]/route");

const req = (method: string, body?: unknown) =>
  new Request("http://test/api", {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
  });
const ctx = { params: Promise.resolve({ id: "c1" }) };
const apptCtx = { params: Promise.resolve({ id: "c1", apptId: "appt1" }) };
const valid = { doctorName: "Dr. Rao", specialty: "Cardiology", date: "2026-11-16", time: "10:30", location: "City Clinic" };

beforeEach(() => {
  vi.mocked(requireUser).mockResolvedValue({ uid: "u-elder", name: "Asha" });
  vi.mocked(getMember).mockResolvedValue(member("elder"));
  vi.mocked(getCircle).mockResolvedValue({ timezone: TZ, active: true } as Circle);
  vi.mocked(createAppointment).mockResolvedValue("a9");
  vi.mocked(updateAppointment).mockResolvedValue(true);
  vi.mocked(deleteAppointment).mockResolvedValue(true);
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/circles/[id]/appointments", () => {
  it("computes startsAt in the circle's time zone (10:30 Kolkata → 05:00Z)", async () => {
    const res = await POST(req("POST", valid), ctx);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "a9" });
    const [, actor, input, startsAt] = vi.mocked(createAppointment).mock.calls[0];
    expect(actor.id).toBe("u-elder");
    expect(input).toMatchObject({ doctorName: "Dr. Rao", durationMinutes: 30 });
    expect(startsAt).toBe("2026-11-16T05:00:00.000Z");
  });

  it("uses a different zone when the circle is elsewhere", async () => {
    vi.mocked(getCircle).mockResolvedValue({ timezone: "America/New_York", active: true } as Circle);
    await POST(req("POST", valid), ctx);
    expect(vi.mocked(createAppointment).mock.calls[0][3]).toBe("2026-11-16T15:30:00.000Z");
  });

  it("ignores a startsAt sent by the client", async () => {
    await POST(req("POST", { ...valid, startsAt: "2000-01-01T00:00:00.000Z" }), ctx);
    expect(vi.mocked(createAppointment).mock.calls[0][3]).toBe("2026-11-16T05:00:00.000Z");
    expect(vi.mocked(createAppointment).mock.calls[0][2]).not.toHaveProperty("startsAt");
  });

  it("returns field errors for a bad time (400)", async () => {
    const res = await POST(req("POST", { ...valid, time: "25:00" }), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).fields).toHaveProperty("time");
    expect(createAppointment).not.toHaveBeenCalled();
  });

  it("forbids family from adding appointments (403)", async () => {
    vi.mocked(getMember).mockResolvedValue(member("family"));
    const res = await POST(req("POST", valid), ctx);
    expect(res.status).toBe(403);
    expect(createAppointment).not.toHaveBeenCalled();
  });

  it("lets a doctor add appointments", async () => {
    vi.mocked(getMember).mockResolvedValue(member("doctor"));
    expect((await POST(req("POST", valid), ctx)).status).toBe(201);
  });
});

describe("PATCH / DELETE /api/circles/[id]/appointments/[apptId]", () => {
  it("recomputes startsAt on edit", async () => {
    const res = await PATCH(req("PATCH", { ...valid, time: "18:00" }), apptCtx);
    expect(res.status).toBe(200);
    expect(vi.mocked(updateAppointment).mock.calls[0][4]).toBe("2026-11-16T12:30:00.000Z");
  });

  it("404s editing or deleting a missing appointment", async () => {
    vi.mocked(updateAppointment).mockResolvedValue(false);
    vi.mocked(deleteAppointment).mockResolvedValue(false);
    expect((await PATCH(req("PATCH", valid), apptCtx)).status).toBe(404);
    expect((await DELETE(req("DELETE"), apptCtx)).status).toBe(404);
  });

  it("deletes an appointment", async () => {
    expect((await DELETE(req("DELETE"), apptCtx)).status).toBe(200);
    expect(vi.mocked(deleteAppointment).mock.calls[0][2]).toBe("appt1");
  });

  it("forbids family from deleting (403)", async () => {
    vi.mocked(getMember).mockResolvedValue(member("family"));
    expect((await DELETE(req("DELETE"), apptCtx)).status).toBe(403);
    expect(deleteAppointment).not.toHaveBeenCalled();
  });
});
