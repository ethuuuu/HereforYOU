import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (c: { name: string }) => cookieJar.delete(c.name),
  }),
}));
vi.mock("@/lib/env", () => ({
  serverEnv: () => ({ WEBAUTHN_RP_ID: "localhost", WEBAUTHN_RP_NAME: "Here For YOU", APP_URL: "http://localhost:3000" }),
}));
vi.mock("@/lib/auth/session", () => {
  class UnauthorizedError extends Error {}
  const getSessionUser = vi.fn();
  return {
    getSessionUser,
    // In these tests a "valid" session is also unrevoked; revocation itself is Firebase's job.
    getVerifiedUser: vi.fn((...args: unknown[]) => getSessionUser(...args)),
    requireUser: vi.fn(async () => {
      throw new UnauthorizedError();
    }),
    UnauthorizedError,
  };
});
vi.mock("@/lib/data/members", () => ({ getMember: vi.fn() }));
vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: () => ({ createUser: createUserMock, getUser: getUserMock, createCustomToken: async (uid: string) => `token-for-${uid}` }),
}));
vi.mock("@/lib/data/rateLimits", () => ({ enforceRateLimit: vi.fn(), clientIp: () => "203.0.113.7" }));

vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: vi.fn(async () => ({ challenge: "reg-challenge" })),
  generateAuthenticationOptions: vi.fn(async () => ({ challenge: "login-challenge" })),
  verifyRegistrationResponse: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));
vi.mock("@/lib/data/passkeys", () => ({
  listPasskeys: vi.fn(async () => []),
  getPasskey: vi.fn(),
  savePasskey: vi.fn(),
  recordPasskeyUse: vi.fn(),
  deletePasskey: vi.fn(),
}));
vi.mock("@/lib/data/webauthnChallenges", () => ({
  CHALLENGE_TTL_MS: 300_000,
  saveChallenge: vi.fn(async () => "chal1"),
  takeChallenge: vi.fn(),
}));
const createUserMock = vi.fn();
const getUserMock = vi.fn(async () => ({ providerData: [{ providerId: "google.com" }] }));

const server = await import("@simplewebauthn/server");
const { getSessionUser, getVerifiedUser, requireUser } = await import("@/lib/auth/session");
const { enforceRateLimit } = await import("@/lib/data/rateLimits");
const { HttpError } = await import("@/lib/http");
const passkeys = await import("@/lib/data/passkeys");
const { saveChallenge, takeChallenge } = await import("@/lib/data/webauthnChallenges");
const registerOptions = (await import("./register/options/route")).POST;
const registerVerify = (await import("./register/verify/route")).POST;
const loginOptions = (await import("./login/options/route")).POST;
const loginVerify = (await import("./login/verify/route")).POST;
const removePasskey = (await import("./[id]/route")).DELETE;

const credential = {
  id: "cred1",
  rawId: "cred1",
  type: "public-key",
  response: { clientDataJSON: "abc", attestationObject: "def" },
  clientExtensionResults: {},
};
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://test/api/passkeys", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
const asha = { uid: "u-asha", name: "Asha", email: "asha@example.com" };
const stored = { id: "cred1", uid: "u-asha", publicKey: "AQID", counter: 4, transports: ["internal"], deviceName: "iPhone", createdAt: "2026-11-01T00:00:00.000Z" };

beforeEach(() => {
  vi.mocked(getSessionUser).mockResolvedValue(null);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.clearAllMocks();
  cookieJar.clear();
});

describe("POST /api/passkeys/register/options", () => {
  it("starts a new account: stores a challenge with the name and sets the challenge cookie", async () => {
    const res = await registerOptions(post({ displayName: "Asha" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ challenge: "reg-challenge" });
    expect(cookieJar.get("hfy_wa")).toBe("chal1");
    expect(saveChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ challenge: "reg-challenge", purpose: "register", newUser: { displayName: "Asha" } }),
    );
    expect(server.generateRegistrationOptions).toHaveBeenCalledWith(
      expect.objectContaining({ rpID: "localhost", authenticatorSelection: { residentKey: "required", userVerification: "preferred" } }),
    );
  });

  it("adds to the signed-in account under the same uid and skips passkeys it already has", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(asha);
    vi.mocked(passkeys.listPasskeys).mockResolvedValue([stored]);
    await registerOptions(post({}));
    expect(saveChallenge).toHaveBeenCalledWith({ challenge: "reg-challenge", purpose: "register", uid: "u-asha" });
    expect(server.generateRegistrationOptions).toHaveBeenCalledWith(
      expect.objectContaining({ excludeCredentials: [{ id: "cred1", transports: ["internal"] }] }),
    );
  });

  it("needs a name when nobody is signed in", async () => {
    const res = await registerOptions(post({}));
    expect(res.status).toBe(400);
    expect(saveChallenge).not.toHaveBeenCalled();
  });
});

describe("POST /api/passkeys/register/verify", () => {
  const newUserChallenge = { challenge: "reg-challenge", purpose: "register" as const, uid: "u-new", newUser: { displayName: "Asha" } };
  const verified = {
    verified: true,
    registrationInfo: { credential: { id: "cred1", publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ["internal"] } },
  };

  it("creates the Firebase user, saves the passkey and returns a custom token", async () => {
    cookieJar.set("hfy_wa", "chal1");
    vi.mocked(takeChallenge).mockResolvedValue(newUserChallenge);
    vi.mocked(server.verifyRegistrationResponse).mockResolvedValue(verified as never);

    const res = await registerVerify(post(credential, { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ customToken: "token-for-u-new" });
    expect(takeChallenge).toHaveBeenCalledWith("chal1", "register");
    expect(createUserMock).toHaveBeenCalledWith({ uid: "u-new", displayName: "Asha" });
    expect(passkeys.savePasskey).toHaveBeenCalledWith({
      id: "cred1",
      uid: "u-new",
      publicKey: "AQID",
      counter: 0,
      transports: ["internal"],
      deviceName: "iPhone",
    });
    expect(cookieJar.has("hfy_wa")).toBe(false);
  });

  it("adds a passkey to the signed-in account without creating a new user", async () => {
    cookieJar.set("hfy_wa", "chal1");
    vi.mocked(getSessionUser).mockResolvedValue(asha);
    vi.mocked(takeChallenge).mockResolvedValue({ challenge: "c", purpose: "register", uid: "u-asha" });
    vi.mocked(server.verifyRegistrationResponse).mockResolvedValue(verified as never);

    expect(await (await registerVerify(post(credential))).json()).toEqual({ ok: true });
    expect(createUserMock).not.toHaveBeenCalled();
    expect(passkeys.savePasskey).toHaveBeenCalledWith(expect.objectContaining({ uid: "u-asha" }));
  });

  it("refuses to add a passkey if a different person is now signed in", async () => {
    cookieJar.set("hfy_wa", "chal1");
    vi.mocked(getSessionUser).mockResolvedValue({ uid: "u-other" });
    vi.mocked(takeChallenge).mockResolvedValue({ challenge: "c", purpose: "register", uid: "u-asha" });
    expect((await registerVerify(post(credential))).status).toBe(401);
    expect(passkeys.savePasskey).not.toHaveBeenCalled();
  });

  it("rejects when there is no challenge cookie", async () => {
    const res = await registerVerify(post(credential));
    expect(res.status).toBe(400);
    expect(takeChallenge).not.toHaveBeenCalled();
    expect(server.verifyRegistrationResponse).not.toHaveBeenCalled();
  });

  it("rejects an expired or already-used challenge", async () => {
    cookieJar.set("hfy_wa", "chal1");
    vi.mocked(takeChallenge).mockResolvedValue(null);
    expect((await registerVerify(post(credential))).status).toBe(400);
    expect(server.verifyRegistrationResponse).not.toHaveBeenCalled();
  });

  it("saves nothing when verification fails", async () => {
    cookieJar.set("hfy_wa", "chal1");
    vi.mocked(takeChallenge).mockResolvedValue(newUserChallenge);
    vi.mocked(server.verifyRegistrationResponse).mockRejectedValue(new Error("Unexpected registration response origin"));
    const res = await registerVerify(post(credential));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "That passkey didn't work. Try again or use Google." });
    expect(createUserMock).not.toHaveBeenCalled();
    expect(passkeys.savePasskey).not.toHaveBeenCalled();
  });

  it("rejects a malformed credential body", async () => {
    cookieJar.set("hfy_wa", "chal1");
    expect((await registerVerify(post({ id: "x", type: "password" }))).status).toBe(400);
    expect(takeChallenge).not.toHaveBeenCalled();
  });
});

describe("POST /api/passkeys/login/options", () => {
  it("issues a discoverable-credential challenge and sets the cookie", async () => {
    const res = await loginOptions();
    expect(await res.json()).toEqual({ challenge: "login-challenge" });
    expect(server.generateAuthenticationOptions).toHaveBeenCalledWith({ rpID: "localhost", userVerification: "preferred" });
    expect(saveChallenge).toHaveBeenCalledWith({ challenge: "login-challenge", purpose: "login" });
    expect(cookieJar.get("hfy_wa")).toBe("chal1");
  });
});

describe("POST /api/passkeys/login/verify", () => {
  beforeEach(() => {
    cookieJar.set("hfy_wa", "chal1");
    vi.mocked(takeChallenge).mockResolvedValue({ challenge: "login-challenge", purpose: "login" });
    vi.mocked(passkeys.getPasskey).mockResolvedValue(stored);
  });

  it("verifies against the stored key, updates the counter and returns a token for the owner", async () => {
    vi.mocked(server.verifyAuthenticationResponse).mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 5 } } as never);
    const res = await loginVerify(post(credential));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ customToken: "token-for-u-asha" });
    expect(takeChallenge).toHaveBeenCalledWith("chal1", "login");
    expect(server.verifyAuthenticationResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedChallenge: "login-challenge",
        expectedOrigin: "http://localhost:3000",
        expectedRPID: "localhost",
        credential: expect.objectContaining({ id: "cred1", counter: 4, publicKey: new Uint8Array([1, 2, 3]) }),
      }),
    );
    expect(passkeys.recordPasskeyUse).toHaveBeenCalledWith("cred1", 5);
  });

  it("rejects an unknown credential", async () => {
    vi.mocked(passkeys.getPasskey).mockResolvedValue(null);
    expect((await loginVerify(post(credential))).status).toBe(401);
    expect(server.verifyAuthenticationResponse).not.toHaveBeenCalled();
  });

  it("rejects an expired, reused or missing challenge", async () => {
    vi.mocked(takeChallenge).mockResolvedValue(null);
    expect((await loginVerify(post(credential))).status).toBe(400);
    expect(passkeys.getPasskey).not.toHaveBeenCalled();
  });

  it("rejects a bad signature and keeps the counter", async () => {
    vi.mocked(server.verifyAuthenticationResponse).mockResolvedValue({ verified: false, authenticationInfo: { newCounter: 9 } } as never);
    expect((await loginVerify(post(credential))).status).toBe(401);
    expect(passkeys.recordPasskeyUse).not.toHaveBeenCalled();
  });
});

describe("passkey registration security", () => {
  it("checks revocation before adding a passkey to an existing account", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(asha);
    await registerOptions(post({}));
    expect(getVerifiedUser).toHaveBeenCalled();
  });

  it("rate-limits anonymous sign-ups per IP (429)", async () => {
    vi.mocked(enforceRateLimit).mockRejectedValueOnce(new HttpError(429, "slow down"));
    const res = await registerOptions(post({ displayName: "Asha" }));
    expect(res.status).toBe(429);
    expect(enforceRateLimit).toHaveBeenCalledWith("passkey-signup:203.0.113.7", 20);
    expect(saveChallenge).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/passkeys/[id]", () => {
  const remove = (id: string) =>
    removePasskey(new Request(`http://test/api/passkeys/${id}`, { method: "DELETE" }), { params: Promise.resolve({ id }) });

  it("removes the signed-in person's own passkey", async () => {
    vi.mocked(requireUser).mockResolvedValue(asha);
    vi.mocked(passkeys.deletePasskey).mockResolvedValue(true);
    expect((await remove("cred1")).status).toBe(200);
    expect(passkeys.deletePasskey).toHaveBeenCalledWith("u-asha", "cred1");
  });

  it("refuses to remove the only passkey of an account with no Google sign-in (no lock-out)", async () => {
    vi.mocked(requireUser).mockResolvedValue(asha);
    vi.mocked(passkeys.listPasskeys).mockResolvedValueOnce([stored]);
    getUserMock.mockResolvedValueOnce({ providerData: [] });
    expect((await remove("cred1")).status).toBe(409);
    expect(passkeys.deletePasskey).not.toHaveBeenCalled();
  });

  it("answers 404 for someone else's passkey", async () => {
    vi.mocked(requireUser).mockResolvedValue({ uid: "u-other" });
    vi.mocked(passkeys.deletePasskey).mockResolvedValue(false);
    expect((await remove("cred1")).status).toBe(404);
  });

  it("requires sign-in", async () => {
    const { UnauthorizedError } = await import("@/lib/auth/session");
    vi.mocked(requireUser).mockRejectedValue(new UnauthorizedError());
    expect((await remove("cred1")).status).toBe(401);
    expect(passkeys.deletePasskey).not.toHaveBeenCalled();
  });
});
