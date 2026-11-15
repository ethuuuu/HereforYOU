import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { member } from "@/test/fixtures";

vi.mock("@/lib/auth/session", () => {
  class UnauthorizedError extends Error {}
  return { requireUser: vi.fn(), UnauthorizedError };
});
vi.mock("@/lib/data/members", () => ({ getMember: vi.fn() }));

const { requireUser, UnauthorizedError } = await import("@/lib/auth/session");
const { getMember } = await import("@/lib/data/members");
const { withCircle, readJson, handle, NotFoundError } = await import("@/lib/http");

const ok = vi.fn(async () => Response.json({ done: true }));
const get = () => new Request("http://test/api/circles/c1/medications");
const post = (body: string, type = "application/json") =>
  new Request("http://test/api/circles/c1/doses", { method: "POST", body, headers: { "content-type": type } });

beforeEach(() => {
  vi.mocked(requireUser).mockResolvedValue({ uid: "u-elder" });
  vi.mocked(getMember).mockResolvedValue(member("elder"));
});
afterEach(() => vi.clearAllMocks());

describe("withCircle", () => {
  it("runs the handler with the user, member and circle when allowed", async () => {
    const res = await withCircle(get(), "c1", "medications.view", ok);
    expect(res.status).toBe(200);
    expect(getMember).toHaveBeenCalledWith("c1", "u-elder");
    expect(ok).toHaveBeenCalledWith({ user: { uid: "u-elder" }, member: member("elder"), circleId: "c1" });
  });

  it("returns 401 when nobody is signed in", async () => {
    vi.mocked(requireUser).mockRejectedValue(new UnauthorizedError());
    const res = await withCircle(get(), "c1", "medications.view", ok);
    expect(res.status).toBe(401);
    expect(ok).not.toHaveBeenCalled();
  });

  it("returns 404 when the user is not a member of the circle", async () => {
    vi.mocked(getMember).mockResolvedValue(null);
    const res = await withCircle(get(), "c1", "medications.view", ok);
    expect(res.status).toBe(404);
    expect(ok).not.toHaveBeenCalled();
  });

  it("returns 404 for a malformed circle id without querying Firestore", async () => {
    const res = await withCircle(get(), "../users/x", "medications.view", ok);
    expect(res.status).toBe(404);
    expect(getMember).not.toHaveBeenCalled();
  });

  it("returns 403 when the member's role does not allow the action", async () => {
    vi.mocked(getMember).mockResolvedValue(member("family"));
    const res = await withCircle(get(), "c1", "medications.edit", ok);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "You don't have permission to do that." });
    expect(ok).not.toHaveBeenCalled();
  });

  it("returns 400 with field messages when the handler's input fails validation", async () => {
    const schema = z.object({ name: z.string().min(1, "Enter the medicine name") });
    const req = post(JSON.stringify({ name: "" }));
    const res = await withCircle(req, "c1", "medications.edit", async () => {
      await readJson(req, schema);
      return Response.json({});
    });
    expect(res.status).toBe(400);
    expect((await res.json()).fields).toEqual({ name: "Enter the medicine name" });
  });

  it("returns 404 when the handler reports something missing", async () => {
    const res = await withCircle(get(), "c1", "medications.view", async () => {
      throw new NotFoundError("Medicine");
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Medicine was not found." });
  });

  it("returns a generic 500 without leaking internal details, and logs it", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await withCircle(get(), "c1", "medications.view", async () => {
      throw new Error("FIRESTORE_PRIVATE_KEY exploded at line 42");
    });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain("FIRESTORE");
    expect(text).not.toContain("line 42");
    expect(log).toHaveBeenCalled();
  });

  it("rejects non-JSON mutations with 415 before reading the session", async () => {
    const res = await withCircle(post("a=1", "application/x-www-form-urlencoded"), "c1", "doses.log", ok);
    expect(res.status).toBe(415);
    expect(requireUser).not.toHaveBeenCalled();
  });

  it("allows bodyless mutations (no content type)", async () => {
    const req = new Request("http://test/api/circles/c1/reminders/run-now", { method: "POST" });
    expect((await withCircle(req, "c1", "medications.edit", ok)).status).toBe(200);
  });
});

describe("readJson", () => {
  const schema = z.object({ n: z.number() });
  const status = async (req: Request) => (await handle(() => readJson(req, schema).then(() => new Response()))).status;

  it("returns the parsed body", async () => {
    expect(await readJson(post('{"n":1}'), schema)).toEqual({ n: 1 });
  });

  it("maps unreadable JSON to 400 and a wrong content type to 415", async () => {
    expect(await status(post("{oops"))).toBe(400);
    expect(await status(post("{}", "text/plain"))).toBe(415);
  });
});
