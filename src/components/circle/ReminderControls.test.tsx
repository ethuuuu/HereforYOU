// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultNotifyPrefs } from "@/lib/domain/reminders";
import { NotifyPrefsForm, SendRemindersNow } from "./ReminderControls";

const respond = (body: unknown, status = 200) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SendRemindersNow", () => {
  it("runs reminders and announces the result in the live region", async () => {
    const fetchMock = respond({ sent: 2, failed: 0 });
    vi.stubGlobal("fetch", fetchMock);
    render(<SendRemindersNow circleId="c1" />);
    await userEvent.click(screen.getByRole("button", { name: "Send reminders now" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/circles/c1/reminders/run-now", expect.objectContaining({ method: "POST" }));
    expect((await screen.findByRole("status")).textContent).toContain("Sent 2 reminder email(s).");
  });

  it("says plainly when nothing was due", async () => {
    vi.stubGlobal("fetch", respond({ sent: 0, failed: 0 }));
    render(<SendRemindersNow circleId="c1" />);
    await userEvent.click(screen.getByRole("button", { name: "Send reminders now" }));
    expect(await screen.findByText("Nothing is due right now — no emails sent.")).toBeTruthy();
  });

  it("shows the server's error", async () => {
    vi.stubGlobal("fetch", respond({ error: "You don't have permission to do that." }, 403));
    render(<SendRemindersNow circleId="c1" />);
    await userEvent.click(screen.getByRole("button", { name: "Send reminders now" }));
    expect(await screen.findByText("You don't have permission to do that.")).toBeTruthy();
  });
});

describe("NotifyPrefsForm", () => {
  it("saves the ticked choices", async () => {
    const fetchMock = respond({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<NotifyPrefsForm circleId="c1" initial={defaultNotifyPrefs("family")} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /A dose was missed/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save email choices" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ...defaultNotifyPrefs("family"), doseMissed: true });
    expect(await screen.findByText("Your email choices are saved.")).toBeTruthy();
  });
});
