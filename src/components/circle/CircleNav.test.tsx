// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CircleNav } from "./CircleNav";

let path = "/c/c1";
vi.mock("next/navigation", () => ({ usePathname: () => path }));
afterEach(cleanup);

const links = [
  { href: "/c/c1", label: "Today", icon: "today" as const, phone: true },
  { href: "/c/c1/medications", label: "Medicines", icon: "medicines" as const, phone: true },
  { href: "/c/c1/activity", label: "Activity", icon: "activity" as const, phone: false },
];

describe("CircleNav", () => {
  const current = (name: string) => screen.getAllByRole("link", { name }).map((l) => l.getAttribute("aria-current"));

  it("marks only Today as current on the circle root, in both the tabs and the phone bar", () => {
    path = "/c/c1";
    render(<CircleNav links={links} />);
    expect(current("Today")).toEqual(["page", "page"]);
    expect(current("Medicines")).toEqual([null, null]);
  });

  it("marks a section current on its sub-pages, not Today", () => {
    path = "/c/c1/medications/new";
    render(<CircleNav links={links} />);
    expect(current("Medicines")).toEqual(["page", "page"]);
    expect(current("Today")).toEqual([null, null]);
  });

  it("keeps desktop-only sections out of the phone bar", () => {
    render(<CircleNav links={links} />);
    const [tabs, phoneBar] = screen.getAllByRole("navigation", { name: "Circle sections" });
    expect(within(tabs).getByRole("link", { name: "Activity" })).toBeInTheDocument();
    expect(within(phoneBar).queryByRole("link", { name: "Activity" })).toBeNull();
  });
});
