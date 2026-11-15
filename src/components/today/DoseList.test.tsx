// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DoseList, type TodayDose } from "./DoseList";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const dose: TodayDose = { doseId: "med1_2026-11-15_0800", name: "Metformin", dose: "500 mg", time: "8:00 am", state: "due" };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DoseList", () => {
  it("marks a dose taken and announces it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<DoseList circleId="c1" doses={[dose]} canLog />);

    expect(screen.getByText("⏰ Due now")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "I took it" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/circles/c1/doses", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ doseId: dose.doseId, status: "taken" });
    expect(await screen.findByText("✓ Taken")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Metformin at 8:00 am: marked as taken");
    expect(screen.queryByRole("button", { name: "I took it" })).toBeNull();
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the server's error and keeps the dose unchanged", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Nope." }), { status: 403 })));
    render(<DoseList circleId="c1" doses={[dose]} canLog />);
    await userEvent.click(screen.getByRole("button", { name: "I took it" }));
    expect(await screen.findByText("Nope.")).toBeTruthy();
    expect(screen.getByText("⏰ Due now")).toBeTruthy();
  });

  it("hides buttons for people who can't log doses", () => {
    render(<DoseList circleId="c1" doses={[dose]} canLog={false} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
