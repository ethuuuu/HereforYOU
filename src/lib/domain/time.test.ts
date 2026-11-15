import { describe, expect, it } from "vitest";
import { addDays, dayOfWeek, localDateOf, zonedToUtc } from "./time";

describe("zonedToUtc", () => {
  it("converts India time (UTC+5:30) correctly", () => {
    expect(zonedToUtc("2026-11-15", "08:00", "Asia/Kolkata").toISOString()).toBe("2026-11-15T02:30:00.000Z");
  });

  it("handles the date rolling back across midnight", () => {
    expect(zonedToUtc("2026-11-15", "02:00", "Asia/Kolkata").toISOString()).toBe("2026-11-14T20:30:00.000Z");
  });

  it("respects daylight saving time in New York", () => {
    expect(zonedToUtc("2026-07-01", "09:00", "America/New_York").toISOString()).toBe("2026-07-01T13:00:00.000Z");
    expect(zonedToUtc("2026-12-01", "09:00", "America/New_York").toISOString()).toBe("2026-12-01T14:00:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(() => zonedToUtc("15-11-2026", "08:00", "Asia/Kolkata")).toThrow();
    expect(() => zonedToUtc("2026-11-15", "8am", "Asia/Kolkata")).toThrow();
  });
});

describe("date helpers", () => {
  it("finds the local date of an instant", () => {
    expect(localDateOf(new Date("2026-11-14T20:00:00Z"), "Asia/Kolkata")).toBe("2026-11-15");
  });
  it("adds days across month ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });
  it("computes day of week", () => {
    expect(dayOfWeek("2026-11-15")).toBe(0); // Sunday
  });
});
