// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { applyModeInBrowser, isElderMode, modeCookie } from "@/lib/mode";

afterEach(() => {
  document.documentElement.className = "";
  document.cookie = "hfy_mode=; Max-Age=0; Path=/";
});

describe("UI mode", () => {
  it("is elder mode only for the exact cookie value", () => {
    expect(isElderMode("elder")).toBe(true);
    expect(isElderMode("standard")).toBe(false);
    expect(isElderMode(undefined)).toBe(false);
    expect(isElderMode("<script>")).toBe(false);
  });

  it("builds a site-wide, lax, readable cookie for the server", () => {
    expect(modeCookie(true)).toEqual({ name: "hfy_mode", value: "elder", path: "/", maxAge: 31536000, sameSite: "lax" });
    expect(modeCookie(false).value).toBe("standard");
  });

  it("switches the <html> class and saves the choice in the browser", () => {
    applyModeInBrowser(true);
    expect(document.documentElement).toHaveClass("elder-mode");
    expect(document.cookie).toContain("hfy_mode=elder");
    applyModeInBrowser(false);
    expect(document.documentElement).not.toHaveClass("elder-mode");
    expect(document.cookie).toContain("hfy_mode=standard");
  });
});
