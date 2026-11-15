import { describe, expect, it } from "vitest";
import { assertCan, can, canChangeRole, ForbiddenError } from "./permissions";

describe("permissions matrix", () => {
  it("lets the elder do everything", () => {
    expect(can("elder", "members.manage")).toBe(true);
  });
  it("lets caretakers and doctors edit medications, but not family", () => {
    expect(can("caretaker", "medications.edit")).toBe(true);
    expect(can("doctor", "medications.edit")).toBe(true);
    expect(can("family", "medications.edit")).toBe(false);
  });
  it("keeps member management away from non-elders", () => {
    expect(can("caretaker", "members.manage")).toBe(false);
    expect(can("doctor", "members.view")).toBe(false);
  });
  it("throws ForbiddenError on disallowed actions", () => {
    expect(() => assertCan("family", "appointments.edit")).toThrow(ForbiddenError);
  });
});

describe("role changes keep the elder in charge", () => {
  it("only the elder manages roles once present", () => {
    expect(canChangeRole("elder", "family", "caretaker", true)).toBe(true);
    expect(canChangeRole("organiser", "family", "caretaker", true)).toBe(false);
  });
  it("the organiser manages roles before the elder claims the profile", () => {
    expect(canChangeRole("organiser", "family", "caretaker", false)).toBe(true);
  });
  it("nobody can demote the elder or grant elder status", () => {
    expect(canChangeRole("elder", "elder", "family", true)).toBe(false);
    expect(canChangeRole("organiser", "family", "elder", false)).toBe(false);
  });
});
