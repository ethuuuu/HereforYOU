import { describe, expect, it } from "vitest";
import { med, TZ } from "@/test/fixtures";
import { daysOfSupplyLeft, dosesForDate, dosesForRange, isScheduledOn, makeDoseId } from "./schedule";

describe("dosesForDate", () => {
  it("expands each time into a dose, sorted, in the elder's zone", () => {
    const doses = dosesForDate([med({ times: ["20:00", "08:00"] })], "2026-11-15", TZ);
    expect(doses.map((d) => d.localTime)).toEqual(["08:00", "20:00"]);
    expect(doses[0].scheduledAt.toISOString()).toBe("2026-11-15T02:30:00.000Z");
    expect(doses[0].doseId).toBe("med1_2026-11-15_0800");
  });

  it("skips inactive, not-yet-started, ended, and off-day medications", () => {
    expect(dosesForDate([med({ active: false })], "2026-11-15", TZ)).toHaveLength(0);
    expect(dosesForDate([med({ startDate: "2026-11-20" })], "2026-11-15", TZ)).toHaveLength(0);
    expect(dosesForDate([med({ endDate: "2026-11-10" })], "2026-11-15", TZ)).toHaveLength(0);
    expect(dosesForDate([med({ daysOfWeek: [1] })], "2026-11-15", TZ)).toHaveLength(0); // Sunday
  });

  it("de-duplicates repeated times", () => {
    expect(dosesForDate([med({ times: ["08:00", "08:00"] })], "2026-11-15", TZ)).toHaveLength(1);
  });
});

describe("helpers", () => {
  it("builds a range across days", () => {
    expect(dosesForRange([med()], "2026-11-14", "2026-11-16", TZ)).toHaveLength(6);
  });
  it("makes stable dose ids", () => {
    expect(makeDoseId("abc", "2026-01-02", "21:30")).toBe("abc_2026-01-02_2130");
  });
  it("checks schedule boundaries inclusively", () => {
    expect(isScheduledOn(med({ startDate: "2026-11-15", endDate: "2026-11-15" }), "2026-11-15")).toBe(true);
  });
  it("estimates days of supply", () => {
    expect(daysOfSupplyLeft(med({ pillsRemaining: 14 }))).toBe(7); // 2 pills/day
    expect(daysOfSupplyLeft(med({ pillsRemaining: undefined }))).toBeNull();
  });
});
