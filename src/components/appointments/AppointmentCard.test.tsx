// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { appointment, TZ } from "@/test/fixtures";
import { AppointmentCard } from "./AppointmentCard";

afterEach(cleanup);

describe("AppointmentCard", () => {
  it("shows the local time and a Google Calendar link for the visit", () => {
    render(<AppointmentCard appointment={appointment({ location: "City Clinic" })} timeZone={TZ} />);
    expect(screen.getByRole("heading", { name: "Dr. Rao (Cardiology)" })).toBeTruthy();
    expect(screen.getByText(/10:00/)).toBeTruthy();

    const cal = screen.getByRole("link", { name: /Add to Google Calendar/ }).getAttribute("href")!;
    expect(cal).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/);
    expect(new URL(cal).searchParams.get("dates")).toBe("20261116T043000Z/20261116T050000Z");

    const maps = screen.getByRole("link", { name: /Directions/ }).getAttribute("href")!;
    expect(maps).toContain("google.com/maps/search");
    expect(maps).toContain("City%20Clinic");
  });

  it("hides Directions without a location and Edit without permission", () => {
    render(<AppointmentCard appointment={appointment()} timeZone={TZ} />);
    expect(screen.queryByRole("link", { name: /Directions/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Edit/ })).toBeNull();
  });
});
