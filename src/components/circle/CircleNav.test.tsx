// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CircleNav } from "./CircleNav";

let path = "/c/c1";
vi.mock("next/navigation", () => ({ usePathname: () => path }));
afterEach(cleanup);

const links = [
  { href: "/c/c1", label: "Today" },
  { href: "/c/c1/medications", label: "Medicines" },
];

describe("CircleNav", () => {
  it("marks only Today as current on the circle root", () => {
    path = "/c/c1";
    render(<CircleNav links={links} />);
    expect(screen.getByRole("link", { name: "Today" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Medicines" }).getAttribute("aria-current")).toBeNull();
  });

  it("marks a section current on its sub-pages, not Today", () => {
    path = "/c/c1/medications/new";
    render(<CircleNav links={links} />);
    expect(screen.getByRole("link", { name: "Medicines" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Today" }).getAttribute("aria-current")).toBeNull();
  });
});
