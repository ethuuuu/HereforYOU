import { describe, expect, it } from "vitest";
import { generateCircleCode, hashPasscode, isLockedOut, verifyPasscode } from "./passcode";

describe("passcode hashing", () => {
  it("verifies the right passcode and rejects a wrong one", async () => {
    const stored = await hashPasscode("482913");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(stored).not.toContain("482913");
    expect(await verifyPasscode("482913", stored)).toBe(true);
    expect(await verifyPasscode("482914", stored)).toBe(false);
  });
  it("salts each hash differently", async () => {
    expect(await hashPasscode("482913")).not.toBe(await hashPasscode("482913"));
  });
  it("rejects malformed stored values", async () => {
    expect(await verifyPasscode("482913", "plain-text")).toBe(false);
  });
});

describe("lockout", () => {
  const now = new Date("2026-11-15T10:00:00Z");
  it("locks after 5 failures for 15 minutes", () => {
    expect(isLockedOut(4, new Date("2026-11-15T09:59:00Z"), now)).toBe(false);
    expect(isLockedOut(5, new Date("2026-11-15T09:50:00Z"), now)).toBe(true);
    expect(isLockedOut(5, new Date("2026-11-15T09:40:00Z"), now)).toBe(false);
  });
});

describe("circle codes", () => {
  it("look like HFY-XXXXXX without ambiguous characters", () => {
    for (let i = 0; i < 50; i++) expect(generateCircleCode()).toMatch(/^HFY-[A-HJ-NP-Z2-9]{6}$/);
  });
});
