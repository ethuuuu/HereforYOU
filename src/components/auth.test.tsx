// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = { push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/firebase/client", () => ({ clientAuth: () => ({}), googleProvider: {} }));
vi.mock("firebase/auth", () => ({ signInWithPopup: vi.fn() }));

const { signInWithPopup } = await import("firebase/auth");
const { GoogleSignIn } = await import("./GoogleSignIn");
const { SignOutButton } = await import("./SignOutButton");

const fetchMock = vi.fn();
beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("GoogleSignIn", () => {
  it("sends the Google ID token to the server and goes where it says", async () => {
    vi.mocked(signInWithPopup).mockResolvedValue({ user: { getIdToken: async () => "tok" } } as never);
    fetchMock.mockResolvedValue(Response.json({ next: "/welcome" }));
    const user = userEvent.setup();
    render(<GoogleSignIn />);

    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/session", expect.objectContaining({ method: "POST", body: '{"idToken":"tok"}' }));
    expect(router.push).toHaveBeenCalledWith("/welcome");
  });

  it("explains a cancelled popup in plain words and lets the person try again", async () => {
    vi.mocked(signInWithPopup).mockRejectedValue({ code: "auth/popup-closed-by-user" });
    const user = userEvent.setup();
    render(<GoogleSignIn />);

    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Sign-in was cancelled");
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows an error when the server refuses the sign-in", async () => {
    vi.mocked(signInWithPopup).mockResolvedValue({ user: { getIdToken: async () => "tok" } } as never);
    fetchMock.mockResolvedValue(Response.json({ error: "no" }, { status: 401 }));
    const user = userEvent.setup();
    render(<GoogleSignIn />);

    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(await screen.findByRole("status")).toHaveTextContent("We couldn't sign you in");
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("SignOutButton", () => {
  it("clears the session and returns to the home page", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    const user = userEvent.setup();
    render(<SignOutButton />);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/session", { method: "DELETE" });
    expect(router.push).toHaveBeenCalledWith("/");
    expect(router.refresh).toHaveBeenCalled();
  });
});
