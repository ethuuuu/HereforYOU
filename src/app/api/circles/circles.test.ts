/**
 * F2 route tests: create, join, claim, role-change, remove, passcode.
 * All Firestore calls are mocked — no live Firebase.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { member } from "@/test/fixtures";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/session", () => {
  class UnauthorizedError extends Error {}
  return { requireUser: vi.fn(), UnauthorizedError };
});

vi.mock("@/lib/data/circles", () => ({
  createCircle: vi.fn(),
  claimCircle: vi.fn(),
  getCircle: vi.fn(),
  rotatePasscode: vi.fn(),
}));

vi.mock("@/lib/data/membership", () => ({
  joinCircle: vi.fn(),
  changeRole: vi.fn(),
  removeMember: vi.fn(),
  setMedsAuthorized: vi.fn(),
}));

vi.mock("@/lib/data/members", () => ({
  getMember: vi.fn(),
}));

// ── Import after mocks ─────────────────────────────────────────────────────

const { requireUser } = await import("@/lib/auth/session");
const { createCircle } = await import("@/lib/data/circles");
const { joinCircle, changeRole, removeMember, setMedsAuthorized } = await import("@/lib/data/membership");
const { getMember } = await import("@/lib/data/members");
const { claimCircle, getCircle, rotatePasscode } = await import("@/lib/data/circles");

const { POST: createPost } = await import("@/app/api/circles/route");
const { POST: joinPost } = await import("@/app/api/circles/join/route");
const { POST: claimPost } = await import("@/app/api/circles/claim/route");
const { PATCH: memberPatch, DELETE: memberDelete } = await import(
  "@/app/api/circles/[id]/members/[uid]/route"
);
const { PUT: medsPut } = await import("@/app/api/circles/[id]/members/[uid]/medicines/route");
const { PUT: passcodePut } = await import("@/app/api/circles/[id]/passcode/route");

// ── Helpers ────────────────────────────────────────────────────────────────

const asha = { uid: "u-elder", name: "Asha", email: "asha@example.com" };
const priya = { uid: "u-family", name: "Priya", email: "priya@example.com" };

function json(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function memberCtx(id: string, uid: string): RouteContext<"/api/circles/[id]/members/[uid]"> {
  return { params: Promise.resolve({ id, uid }) };
}
function passcodeCtx(id: string): RouteContext<"/api/circles/[id]/passcode"> {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.mocked(requireUser).mockResolvedValue(asha);
});
afterEach(() => vi.clearAllMocks());

// ── POST /api/circles ──────────────────────────────────────────────────────

describe("POST /api/circles", () => {
  it("creates a circle and returns circleId + code", async () => {
    vi.mocked(createCircle).mockResolvedValue({ circleId: "c1", code: "HFY-ABC123" });
    const res = await createPost(
      json("http://test/api/circles", "POST", {
        setupRole: "elder",
        elderName: "Asha",
        timezone: "Asia/Kolkata",
        passcode: "283746",
        largeText: true,
      }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ circleId: "c1", code: "HFY-ABC123" });
    expect(createCircle).toHaveBeenCalledWith(
      asha,
      expect.objectContaining({ setupRole: "elder", elderName: "Asha" }),
      "Asha",
    );
  });

  it("returns 401 when not signed in", async () => {
    vi.mocked(requireUser).mockRejectedValue(new (await import("@/lib/auth/session")).UnauthorizedError());
    const res = await createPost(
      json("http://test/api/circles", "POST", {
        setupRole: "elder",
        elderName: "Asha",
        timezone: "Asia/Kolkata",
        passcode: "283746",
        largeText: true,
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid passcode (too weak)", async () => {
    const res = await createPost(
      json("http://test/api/circles", "POST", {
        setupRole: "elder",
        elderName: "Asha",
        timezone: "Asia/Kolkata",
        passcode: "111111", // all same digit
        largeText: true,
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).fields).toHaveProperty("passcode");
  });

  it("returns 400 when elderName is missing", async () => {
    const res = await createPost(
      json("http://test/api/circles", "POST", {
        setupRole: "elder",
        elderName: "",
        timezone: "Asia/Kolkata",
        passcode: "283746",
        largeText: true,
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).fields).toHaveProperty("elderName");
  });

  it("includes a claimCode when setup role is not elder", async () => {
    vi.mocked(createCircle).mockResolvedValue({
      circleId: "c2",
      code: "HFY-XYZ789",
      claimCode: "042315",
    });
    const res = await createPost(
      json("http://test/api/circles", "POST", {
        setupRole: "family",
        elderName: "Grandma",
        timezone: "Asia/Kolkata",
        passcode: "987654",
        largeText: false,
      }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).claimCode).toBe("042315");
  });
});

// ── POST /api/circles/join ─────────────────────────────────────────────────

describe("POST /api/circles/join", () => {
  it("joins successfully and returns circleId", async () => {
    vi.mocked(requireUser).mockResolvedValue(priya);
    vi.mocked(joinCircle).mockResolvedValue({ result: "ok", circleId: "c1" });
    const res = await joinPost(
      json("http://test/api/circles/join", "POST", {
        circleCode: "HFY-ABC123",
        passcode: "283746",
        displayName: "Priya",
        setupRole: "family",
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ circleId: "c1" });
  });

  it("returns 403 for a wrong code / wrong passcode (same message for both)", async () => {
    vi.mocked(joinCircle).mockResolvedValue({ result: "invalid" });
    const res = await joinPost(
      json("http://test/api/circles/join", "POST", {
        circleCode: "HFY-ZZZZZZ",
        passcode: "000000",
        displayName: "Hacker",
        setupRole: "family",
      }),
    );
    expect(res.status).toBe(403);
    // Error message must NOT distinguish between wrong code vs wrong passcode
    const { error } = await res.json();
    expect(error).toMatch(/don't match/i);
  });

  it("returns 429 when the circle is locked", async () => {
    vi.mocked(joinCircle).mockResolvedValue({ result: "locked" });
    const res = await joinPost(
      json("http://test/api/circles/join", "POST", {
        circleCode: "HFY-ABC123",
        passcode: "000000",
        displayName: "Priya",
        setupRole: "family",
      }),
    );
    expect(res.status).toBe(429);
  });

  it("returns 400 when the circle code format is wrong", async () => {
    const res = await joinPost(
      json("http://test/api/circles/join", "POST", {
        circleCode: "BADCODE",
        passcode: "283746",
        displayName: "Priya",
        setupRole: "family",
      }),
    );
    expect(res.status).toBe(400);
  });
});

// ── POST /api/circles/claim ────────────────────────────────────────────────

describe("POST /api/circles/claim", () => {
  it("claims successfully and returns circleId", async () => {
    vi.mocked(claimCircle).mockResolvedValue({ result: "ok", circleId: "c1" });
    const res = await claimPost(
      json("http://test/api/circles/claim", "POST", {
        circleCode: "HFY-ABC123",
        claimCode: "042315",
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ circleId: "c1" });
  });

  it("returns 403 when codes are invalid", async () => {
    vi.mocked(claimCircle).mockResolvedValue({ result: "invalid" });
    const res = await claimPost(
      json("http://test/api/circles/claim", "POST", {
        circleCode: "HFY-ABC123",
        claimCode: "000000",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 409 when circle is already claimed", async () => {
    vi.mocked(claimCircle).mockResolvedValue({ result: "already_claimed" });
    const res = await claimPost(
      json("http://test/api/circles/claim", "POST", {
        circleCode: "HFY-ABC123",
        claimCode: "042315",
      }),
    );
    expect(res.status).toBe(409);
  });

  it("returns 409 when the organiser enters their own confirmation code", async () => {
    vi.mocked(claimCircle).mockResolvedValue({ result: "is_organiser" });
    const res = await claimPost(
      json("http://test/api/circles/claim", "POST", {
        circleCode: "HFY-ABC123",
        claimCode: "042315",
      }),
    );
    expect(res.status).toBe(409);
  });

  it("returns 400 when claimCode is not 6 digits", async () => {
    const res = await claimPost(
      json("http://test/api/circles/claim", "POST", {
        circleCode: "HFY-ABC123",
        claimCode: "1234", // too short
      }),
    );
    expect(res.status).toBe(400);
  });
});

// ── PATCH /api/circles/[id]/members/[uid] ─────────────────────────────────

describe("PATCH /api/circles/[id]/members/[uid]", () => {
  beforeEach(() => {
    vi.mocked(getMember).mockResolvedValue(member("elder"));
  });

  it("changes a member's role", async () => {
    vi.mocked(changeRole).mockResolvedValue("ok");
    const res = await memberPatch(
      json("http://test/api/circles/c1/members/u-family", "PATCH", { role: "caretaker" }),
      memberCtx("c1", "u-family"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 403 when changeRole says forbidden", async () => {
    vi.mocked(changeRole).mockResolvedValue("forbidden");
    const res = await memberPatch(
      json("http://test/api/circles/c1/members/u-elder", "PATCH", { role: "family" }),
      memberCtx("c1", "u-elder"),
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when target member not found", async () => {
    vi.mocked(changeRole).mockResolvedValue("not_found");
    const res = await memberPatch(
      json("http://test/api/circles/c1/members/ghost", "PATCH", { role: "family" }),
      memberCtx("c1", "ghost"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when acting member doesn't have members.manage", async () => {
    vi.mocked(getMember).mockResolvedValue(member("family"));
    const res = await memberPatch(
      json("http://test/api/circles/c1/members/u-other", "PATCH", { role: "caretaker" }),
      memberCtx("c1", "u-other"),
    );
    expect(res.status).toBe(403);
    expect(changeRole).not.toHaveBeenCalled();
  });

  it("returns 400 when role value is not assignable", async () => {
    const res = await memberPatch(
      json("http://test/api/circles/c1/members/u-family", "PATCH", { role: "elder" }),
      memberCtx("c1", "u-family"),
    );
    expect(res.status).toBe(400);
  });
});

// ── PUT /api/circles/[id]/members/[uid]/medicines ─────────────────────────

describe("PUT /api/circles/[id]/members/[uid]/medicines", () => {
  const ctx: RouteContext<"/api/circles/[id]/members/[uid]/medicines"> = { params: Promise.resolve({ id: "c1", uid: "u-caretaker" }) };
  const put = (body: unknown) => medsPut(json("http://test/api", "PUT", body), ctx);
  beforeEach(() => vi.mocked(getMember).mockResolvedValue(member("elder", { name: "Asha" })));

  it("allows a member to add medicines", async () => {
    vi.mocked(setMedsAuthorized).mockResolvedValue("ok");
    const res = await put({ medsAuthorized: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, medsAuthorized: true });
    expect(setMedsAuthorized).toHaveBeenCalledWith("c1", member("elder", { name: "Asha" }), "u-caretaker", true);
  });

  it("returns 403 with a plain reason when the data layer refuses (not the owner, or a doctor/owner target)", async () => {
    vi.mocked(getMember).mockResolvedValue(member("caretaker"));
    vi.mocked(setMedsAuthorized).mockResolvedValue("forbidden");
    const res = await put({ medsAuthorized: true });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/Only the person who set up the circle, or the elder/);
  });

  it("returns 404 for an unknown member and 400 for a bad body", async () => {
    vi.mocked(setMedsAuthorized).mockResolvedValue("not_found");
    expect((await put({ medsAuthorized: false })).status).toBe(404);
    expect((await put({ medsAuthorized: "yes" })).status).toBe(400);
  });
});

// ── DELETE /api/circles/[id]/members/[uid] ────────────────────────────────

describe("DELETE /api/circles/[id]/members/[uid]", () => {
  beforeEach(() => {
    vi.mocked(getMember).mockResolvedValue(member("elder"));
  });

  it("removes a member", async () => {
    vi.mocked(removeMember).mockResolvedValue("ok");
    const res = await memberDelete(
      new Request("http://test/api/circles/c1/members/u-family", { method: "DELETE" }),
      memberCtx("c1", "u-family"),
    );
    expect(res.status).toBe(200);
  });

  it("returns 403 when acting member is family (no permission)", async () => {
    vi.mocked(getMember).mockResolvedValue(member("family"));
    const res = await memberDelete(
      new Request("http://test/api/circles/c1/members/u-other", { method: "DELETE" }),
      memberCtx("c1", "u-other"),
    );
    expect(res.status).toBe(403);
    expect(removeMember).not.toHaveBeenCalled();
  });
});

// ── PUT /api/circles/[id]/passcode ────────────────────────────────────────

describe("PUT /api/circles/[id]/passcode", () => {
  beforeEach(() => {
    vi.mocked(getMember).mockResolvedValue(member("elder"));
    vi.mocked(getCircle).mockResolvedValue({
      id: "c1",
      code: "HFY-ABC123",
      elderName: "Asha",
      timezone: "Asia/Kolkata",
      passcodeHash: "hash",
      failedAttempts: 0,
      elderUid: "u-elder",
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: "u-elder",
    });
    vi.mocked(rotatePasscode).mockResolvedValue(undefined);
  });

  it("rotates the passcode for the elder", async () => {
    const res = await passcodePut(
      json("http://test/api/circles/c1/passcode", "PUT", { passcode: "987654" }),
      passcodeCtx("c1"),
    );
    expect(res.status).toBe(200);
    expect(rotatePasscode).toHaveBeenCalledWith("c1", expect.objectContaining({ id: "u-elder" }), "987654");
  });

  it("returns 403 when a caretaker tries to rotate after the elder has claimed", async () => {
    vi.mocked(getMember).mockResolvedValue(member("caretaker"));
    const res = await passcodePut(
      json("http://test/api/circles/c1/passcode", "PUT", { passcode: "987654" }),
      passcodeCtx("c1"),
    );
    // withCircle allows members.manage for caretaker? No — caretaker can't members.manage.
    expect(res.status).toBe(403);
    expect(rotatePasscode).not.toHaveBeenCalled();
  });

  it("returns 400 for a weak passcode", async () => {
    const res = await passcodePut(
      json("http://test/api/circles/c1/passcode", "PUT", { passcode: "123456789" }), // sequential
      passcodeCtx("c1"),
    );
    expect(res.status).toBe(400);
  });
});
