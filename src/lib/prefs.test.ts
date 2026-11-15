import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, parsePrefs, prefsClassName, prefsCookieString, serializePrefs } from "@/lib/prefs";

describe("display prefs", () => {
  it("uses defaults when there is no cookie", () => {
    expect(parsePrefs(undefined)).toEqual(DEFAULT_PREFS);
  });

  it("round-trips through the cookie value", () => {
    const prefs = { largeText: true, highContrast: false, readAloud: true };
    expect(parsePrefs(serializePrefs(prefs))).toEqual(prefs);
    expect(parsePrefs(encodeURIComponent(serializePrefs(prefs)))).toEqual(prefs);
  });

  it("ignores unknown or junk values", () => {
    expect(parsePrefs("<script>,highContrast")).toEqual({ largeText: false, highContrast: true, readAloud: false });
  });

  it("maps prefs to <html> classes", () => {
    expect(prefsClassName({ largeText: true, highContrast: true, readAloud: true })).toBe("large-text high-contrast");
    expect(prefsClassName(DEFAULT_PREFS)).toBe("");
  });

  it("builds a site-wide, lax cookie", () => {
    expect(prefsCookieString({ ...DEFAULT_PREFS, largeText: true })).toMatch(
      /^hfy_prefs=largeText%2CreadAloud; Path=\/; Max-Age=\d+; SameSite=Lax$/,
    );
  });
});
