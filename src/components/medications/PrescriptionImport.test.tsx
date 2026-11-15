// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrescriptionImport } from "./PrescriptionImport";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push }) }));

const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const draft = {
  medications: [
    { name: "Metformin", dose: "500 mg", times: ["08:00", "20:00"], instructions: "after food" },
    { name: "Amlodipine", dose: "5 mg", times: ["08:00"] },
  ],
  uncertain: ["The second dose time is hard to read."],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockClear();
});

describe("PrescriptionImport", () => {
  it("shows editable drafts and saves only the ticked ones after Save", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok({ draft })).mockResolvedValue(ok({ id: "m1" }, 201));
    vi.stubGlobal("fetch", fetchMock);
    render(<PrescriptionImport circleId="c1" today="2026-11-15" />);

    await userEvent.type(screen.getByLabelText("Paste the prescription text"), "Metformin 500mg 1-0-1");
    await userEvent.click(screen.getByRole("button", { name: "Read my prescription" }));

    expect(await screen.findByRole("heading", { name: "Check these medicines" })).toBeTruthy();
    expect(screen.getByText(/Suggestion only — check with your doctor or pharmacist/)).toBeTruthy();
    expect(screen.getByText("The second dose time is hard to read.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the AI read — nothing saved yet
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ text: "Metformin 500mg 1-0-1" });

    const dose = screen.getByLabelText("Medicine 1: dose");
    await userEvent.clear(dose);
    await userEvent.type(dose, "1000 mg");
    await userEvent.click(screen.getByRole("checkbox", { name: "Save medicine 2" }));
    await userEvent.click(screen.getByRole("button", { name: "Save selected medicines" }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/circles/c1/medications");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      name: "Metformin",
      dose: "1000 mg",
      times: ["08:00", "20:00"],
      instructions: "after food",
      startDate: "2026-11-15",
    });
    expect(push).toHaveBeenCalledWith("/c/c1/medications");
  });

  it("shows the error and offers a retry when the AI fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ error: "We couldn't read that prescription just now." }, 502)));
    render(<PrescriptionImport circleId="c1" today="2026-11-15" />);
    await userEvent.type(screen.getByLabelText("Paste the prescription text"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Read my prescription" }));
    expect(await screen.findByText("We couldn't read that prescription just now.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("asks for input instead of calling the server when nothing is given", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<PrescriptionImport circleId="c1" today="2026-11-15" />);
    await userEvent.click(screen.getByRole("button", { name: "Read my prescription" }));
    expect(screen.getByRole("status").textContent).toContain("Paste the prescription or add a photo.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
