import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserProfile } from "@/lib/domain/schemas";
import { DEFAULT_PREFS } from "@/lib/prefs";

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined) }),
}));
vi.mock("@/lib/auth/session", () => {
  class UnauthorizedError extends Error {}
  return { createSession: vi.fn(), clearSession: vi.fn(), requireUser: vi.fn(), UnauthorizedError };
});
vi.mock("@/lib/data/users", () => ({ ensureUser: vi.fn() }));
vi.mock("@/lib/data/members", () => ({ getMember: vi.fn() }));

const { createSession, clearSession } = await import("@/lib/auth/session");
const { ensureUser } = await import("@/lib/data/users");
const { POST, DELETE } = await import("./route");

const asha = { uid: "u-elder", name: "Asha", email: "asha@example.com" };
const profile = (circleIds: string[] = []): UserProfile => ({
  displayName: "Asha",
  circleIds,
  prefs: DEFAULT_PREFS,
  createdAt: "2026-11-15T00:00:00.000Z",
});
const signIn = (body: unknown, type = "application/json") =>
  POST(new Request("http://test/api/session", { method: "POST", body: JSON.stringify(body), headers: { "content-type": type } }));

beforeEach(() => {
  vi.mocked(createSession).mockResolvedValue(asha);
  vi.mocked(ensureUser).mockResolvedValue(profile());
});
afterEach(() => {
  vi.clearAllMocks();
  cookieJar.clear();
});

describe("POST /api/session", () => {
  it("creates the session and the user profile, then sends a new user to /welcome", async () => {
    const res = await signIn({ idToken: "tok" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ next: "/welcome" });
    expect(createSession).toHaveBeenCalledWith("tok");
    expect(ensureUser).toHaveBeenCalledWith(asha, DEFAULT_PREFS);
  });

  it("saves the display prefs chosen on this device into a new profile", async () => {
    cookieJar.set("hfy_prefs", "largeText,highContrast");
    await signIn({ idToken: "tok" });
    expect(ensureUser).toHaveBeenCalledWith(asha, { largeText: true, highContrast: true, readAloud: false });
  });

  it("sends a returning member straight to their circle", async () => {
    vi.mocked(ensureUser).mockResolvedValue(profile(["c1"]));
    expect(await (await signIn({ idToken: "tok" })).json()).toEqual({ next: "/c/c1" });
  });

  it("returns 401 with a plain message when the token is invalid or too old", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(createSession).mockRejectedValue(new Error("Sign-in too old"));
    const res = await signIn({ idToken: "old" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "We couldn't sign you in. Please try again." });
    expect(ensureUser).not.toHaveBeenCalled();
  });

  it("returns 400 when the token is missing", async () => {
    expect((await signIn({})).status).toBe(400);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("returns 415 for non-JSON bodies", async () => {
    expect((await signIn("idToken=tok", "application/x-www-form-urlencoded")).status).toBe(415);
  });
});

describe("DELETE /api/session", () => {
  it("signs out by clearing the session cookie", async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(clearSession).toHaveBeenCalled();
  });
});
