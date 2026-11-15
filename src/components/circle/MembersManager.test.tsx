// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { member } from "@/test/fixtures";
import { MembersManager } from "./MembersManager";

const members = [
  member("elder", { name: "Asha", medsAuthorized: true }),
  member("caretaker", { name: "Priya", medsAuthorized: false }),
  member("doctor", { name: "Dr Rao" }),
];
const owners = { createdBy: "u-elder", elderUid: "u-elder" };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MembersManager medicines switch", () => {
  it("lets the owner allow a caretaker to add medicines", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    render(<MembersManager circleId="c1" members={members} myRole="elder" myId="u-elder" hasElder owners={owners} />);

    const toggle = screen.getByRole("switch", { name: /Can add and edit medicines: Priya/ });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    await userEvent.click(toggle);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/circles/c1/members/u-caretaker/medicines",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ medsAuthorized: true }) }),
    );
    expect(await screen.findByText("Priya can now add and edit medicines.")).toBeTruthy();
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("shows doctors as always allowed, with no switch for them or the owner", () => {
    render(<MembersManager circleId="c1" members={members} myRole="elder" myId="u-elder" hasElder owners={owners} />);
    expect(screen.getAllByRole("switch")).toHaveLength(1);
    expect(screen.getByText("Doctor — always allowed to add medicines.")).toBeTruthy();
    expect(screen.getAllByText("Can add medicines")).toHaveLength(2); // Asha + Dr Rao
  });

  it("shows no switches to someone who isn't the owner", () => {
    render(<MembersManager circleId="c1" members={members} myRole="caretaker" myId="u-caretaker" hasElder owners={owners} />);
    expect(screen.queryByRole("switch")).toBeNull();
  });
});
