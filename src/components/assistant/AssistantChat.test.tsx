// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantChat } from "./AssistantChat";

const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const pending = { tool: "log_dose", args: { doseId: "med1_2026-11-15_0800", status: "taken" }, summary: "Mark Metformin 500 mg (8:00 AM) as taken?" };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function say(text: string) {
  await userEvent.type(screen.getByLabelText("Type your message"), text);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
}

describe("AssistantChat", () => {
  it("shows the reply with the safety notice and a read-aloud button", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ reply: "You take Metformin at 8:00 AM." })));
    render(<AssistantChat circleId="c1" />);
    await say("What do I take today?");

    const log = screen.getByRole("log", { name: "Conversation" });
    expect(await screen.findByText("You take Metformin at 8:00 AM.")).toBeInTheDocument();
    expect(log).toHaveTextContent("What do I take today?");
    expect(screen.getByText(/Suggestion only — check with your doctor or pharmacist/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Read this aloud/ })).toBeInTheDocument();
  });

  it("asks for confirmation before acting, and only acts after 'Yes, do it'", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ reply: "Shall I mark it?", pending }))
      .mockResolvedValueOnce(ok({ reply: "Done. Metformin is marked as taken." }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AssistantChat circleId="c1" />);
    await say("I took my Metformin");

    expect(await screen.findByRole("heading", { name: "Shall I do this?" })).toBeInTheDocument();
    expect(screen.getByText(pending.summary)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // nothing done yet

    await userEvent.click(screen.getByRole("button", { name: /Yes, do it/ }));
    expect(await screen.findByText("Done. Metformin is marked as taken.")).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ confirm: { tool: pending.tool, args: pending.args } });
    expect(screen.queryByRole("heading", { name: "Shall I do this?" })).not.toBeInTheDocument();
  });

  it("'No' cancels without calling the server", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ reply: "", pending }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AssistantChat circleId="c1" />);
    await say("I took it");
    await userEvent.click(await screen.findByRole("button", { name: /No/ }));
    expect(screen.getByText("Okay, I won't do that.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the server's error in the live region", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ error: "The assistant isn't available right now." }, 502)));
    render(<AssistantChat circleId="c1" />);
    await say("hi");
    expect(await screen.findByRole("status")).toHaveTextContent("The assistant isn't available right now.");
  });
});
