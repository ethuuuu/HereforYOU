import { describe, expect, it } from "vitest";
import { med, TZ } from "@/test/fixtures";
import { adherenceStreak, doseState, summarizeAdherence } from "./adherence";
import { dosesForDate } from "./schedule";
import type { DoseLog } from "./schemas";

const doses = dosesForDate([med()], "2026-11-15", TZ); // 08:00 and 20:00 IST
const log = (doseId: string, status: DoseLog["status"] = "taken"): DoseLog => ({
  doseId,
  medicationId: "med1",
  localDate: doseId.split("_")[1],
  status,
  loggedBy: "u-elder",
  loggedAt: "2026-11-15T03:00:00.000Z",
});

describe("doseState", () => {
  const morning = doses[0]; // 02:30Z
  it("is upcoming before the time, due during grace, missed after", () => {
    expect(doseState(morning, undefined, new Date("2026-11-15T02:00:00Z"))).toBe("upcoming");
    expect(doseState(morning, undefined, new Date("2026-11-15T02:45:00Z"))).toBe("due");
    expect(doseState(morning, undefined, new Date("2026-11-15T03:00:00Z"))).toBe("missed");
  });
  it("uses the log when present", () => {
    expect(doseState(morning, log(morning.doseId, "skipped"), new Date("2026-11-15T09:00:00Z"))).toBe("skipped");
  });
});

describe("summarizeAdherence", () => {
  it("counts states and computes the rate over decided doses", () => {
    const now = new Date("2026-11-15T10:00:00Z"); // after morning, before evening
    const s = summarizeAdherence(doses, [log(doses[0].doseId)], now);
    expect(s).toEqual({ taken: 1, skipped: 0, missed: 0, pending: 1, rate: 1 });
  });
  it("returns a null rate when nothing is decided", () => {
    expect(summarizeAdherence(doses, [], new Date("2026-11-15T00:00:00Z")).rate).toBeNull();
  });
});

describe("adherenceStreak", () => {
  it("counts consecutive fully-taken past days and stops at a gap", () => {
    const d13 = dosesForDate([med()], "2026-11-13", TZ);
    const d14 = dosesForDate([med()], "2026-11-14", TZ);
    const byDate = new Map([
      ["2026-11-13", d13],
      ["2026-11-14", d14],
      ["2026-11-15", doses],
    ]);
    const logs = [...d14.map((d) => log(d.doseId)), log(d13[0].doseId)]; // 13th incomplete
    expect(adherenceStreak(byDate, logs, "2026-11-15", new Date("2026-11-15T10:00:00Z"))).toBe(1);
  });
});
