import { describe, expect, it } from "vitest";
import { member } from "@/test/fixtures";
import {
  assertCan,
  can,
  canChangeRole,
  canEditMedicines,
  canSetMedsAuthorized,
  ForbiddenError,
  isCircleOwner,
} from "./permissions";

describe("canEditMedicines", () => {
  it.each([
    ["elder", undefined, true], // saved before the flag existed: role decides
    ["organiser", undefined, true],
    ["caretaker", undefined, false],
    ["family", undefined, false],
    ["doctor", undefined, true],
    ["caretaker", true, true],
    ["caretaker", false, false],
    ["doctor", false, true], // doctors are always allowed
    ["family", true, false], // the role must allow editing medicines too
  ] as const)("%s with medsAuthorized=%s → %s", (role, flag, expected) => {
    expect(canEditMedicines({ role, medsAuthorized: flag })).toBe(expected);
  });
});

describe("canSetMedsAuthorized", () => {
  const circle = { createdBy: "u-organiser", elderUid: "u-elder" };

  it("treats the creator and the elder as owners", () => {
    expect(isCircleOwner(circle, "u-organiser")).toBe(true);
    expect(isCircleOwner(circle, "u-elder")).toBe(true);
    expect(isCircleOwner(circle, "u-caretaker")).toBe(false);
    expect(isCircleOwner({ createdBy: "u-organiser" }, "u-elder")).toBe(false);
  });

  it("lets the creator or the elder switch a caretaker", () => {
    expect(canSetMedsAuthorized(circle, "u-organiser", member("caretaker"))).toBe(true);
    expect(canSetMedsAuthorized(circle, "u-elder", member("caretaker"))).toBe(true);
  });

  it("refuses everyone else, and never switches doctors, owners or family", () => {
    expect(canSetMedsAuthorized(circle, "u-caretaker", member("caretaker", { id: "u-2" }))).toBe(false);
    expect(canSetMedsAuthorized(circle, "u-elder", member("doctor"))).toBe(false);
    expect(canSetMedsAuthorized(circle, "u-elder", member("organiser"))).toBe(false);
    expect(canSetMedsAuthorized(circle, "u-organiser", member("elder"))).toBe(false);
    expect(canSetMedsAuthorized(circle, "u-elder", member("family"))).toBe(false);
  });
});

describe("permissions matrix", () => {
  it("lets the elder do everything", () => {
    expect(can("elder", "members.manage")).toBe(true);
  });
  it("lets caretakers and doctors edit medications, but not family", () => {
    expect(can("caretaker", "medications.edit")).toBe(true);
    expect(can("doctor", "medications.edit")).toBe(true);
    expect(can("family", "medications.edit")).toBe(false);
  });
  it("lets only elder, organiser and caretaker send reminders now", () => {
    expect(can("elder", "reminders.run")).toBe(true);
    expect(can("organiser", "reminders.run")).toBe(true);
    expect(can("caretaker", "reminders.run")).toBe(true);
    expect(can("doctor", "reminders.run")).toBe(false);
    expect(can("family", "reminders.run")).toBe(false);
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
