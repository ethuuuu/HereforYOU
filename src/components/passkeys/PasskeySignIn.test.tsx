// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = { push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/firebase/client", () => ({ clientAuth: () => ({}) }));
vi.mock("firebase/auth", () => ({
  signInWithCustomToken: vi.fn(async () => ({ user: { getIdToken: async () => "id-tok" } })),
}));
vi.mock("@simplewebauthn/browser", () => ({
  browserSupportsWebAuthn: vi.fn(() => true),
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}));

const webauthn = await import("@simplewebauthn/browser");
const { signInWithCustomToken } = await import("firebase/auth");
const { PasskeySignIn } = await import("./PasskeySignIn");

const fetchMock = vi.fn();
const BUTTON = { name: "Sign in with fingerprint or face" };
beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("PasskeySignIn", () => {
  it("signs in with the passkey and opens the person's own circle", async () => {
    vi.mocked(webauthn.startAuthentication).mockResolvedValue({ id: "cred1" } as never);
    fetchMock
      .mockResolvedValueOnce(Response.json({ challenge: "c" }))
      .mockResolvedValueOnce(Response.json({ customToken: "custom" }))
      .mockResolvedValueOnce(Response.json({ next: "/c/circle1" }));
    const user = userEvent.setup();
    render(<PasskeySignIn />);

    await user.click(screen.getByRole("button", BUTTON));

    expect(webauthn.startAuthentication).toHaveBeenCalledWith({ optionsJSON: { challenge: "c" } });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(["/api/passkeys/login/options", "/api/passkeys/login/verify", "/api/session"]);
    expect(signInWithCustomToken).toHaveBeenCalledWith({}, "custom");
    expect(fetchMock.mock.calls[2][1].body).toBe('{"idToken":"id-tok"}');
    expect(router.push).toHaveBeenCalledWith("/c/circle1");
  });

  it("explains a cancelled fingerprint prompt and stays on the page", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ challenge: "c" }));
    vi.mocked(webauthn.startAuthentication).mockRejectedValue(Object.assign(new Error("x"), { name: "NotAllowedError" }));
    const user = userEvent.setup();
    render(<PasskeySignIn />);

    await user.click(screen.getByRole("button", BUTTON));

    expect(await screen.findByRole("status")).toHaveTextContent("That was cancelled");
    expect(screen.getByRole("button", BUTTON)).toBeEnabled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("is hidden where the browser can't use passkeys", () => {
    vi.mocked(webauthn.browserSupportsWebAuthn).mockReturnValue(false);
    render(<PasskeySignIn />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
