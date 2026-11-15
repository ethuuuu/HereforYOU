import { describe, expect, it } from "vitest";
import { googleCalendarUrl, googleMapsUrl } from "./calendar";

describe("googleCalendarUrl", () => {
  it("builds a template link with UTC start/end", () => {
    const url = new URL(
      googleCalendarUrl({ title: "Dr. Rao", start: new Date("2026-11-16T04:30:00Z"), durationMinutes: 30, location: "Apollo, Bengaluru" }),
    );
    expect(url.hostname).toBe("calendar.google.com");
    expect(url.searchParams.get("dates")).toBe("20261116T043000Z/20261116T050000Z");
    expect(url.searchParams.get("location")).toBe("Apollo, Bengaluru");
  });
});

describe("googleMapsUrl", () => {
  it("encodes the address", () => {
    expect(googleMapsUrl("MG Road & 1st Cross")).toContain("MG%20Road%20%26%201st%20Cross");
  });
});
