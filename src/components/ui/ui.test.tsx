// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DisplayToggles } from "@/components/DisplayToggles";
import { DEFAULT_PREFS } from "@/lib/prefs";
import { Button } from "./Button";
import { Field } from "./Field";
import { ReadAloud } from "./ReadAloud";
import { Toast } from "./Toast";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.className = "";
  document.cookie = "hfy_prefs=; Max-Age=0; Path=/";
});

describe("Field", () => {
  it("links the hint and error to the input and marks it invalid", () => {
    render(<Field label="Time" hint="Like 8:00 AM" error="Enter the time like 8:00 AM" />);
    const input = screen.getByLabelText("Time");
    expect(input).toHaveAccessibleDescription("Like 8:00 AM Enter the time like 8:00 AM");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("has no description or invalid state when there is nothing to say", () => {
    render(<Field label="Name" />);
    const input = screen.getByLabelText("Name");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input).not.toHaveAttribute("aria-invalid");
  });
});

describe("Button", () => {
  it("shows the loading text and can't be pressed while busy", () => {
    render(
      <Button loading loadingText="Saving…">
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saving…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});

describe("Toast", () => {
  it("announces messages in a polite live region with an icon and words", () => {
    render(<Toast message="Saved Metformin" tone="success" />);
    expect(screen.getByRole("status")).toHaveTextContent("✓Saved Metformin");
  });
});

describe("ReadAloud", () => {
  function stubSpeech() {
    const speak = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak, cancel });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        lang = "";
        rate = 1;
        constructor(public text: string) {}
      },
    );
    return { speak, cancel };
  }
  function stubAudio() {
    const play = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn();
    vi.stubGlobal("Audio", class { src = ""; onended: (() => void) | null = null; play = play; pause = pause; });
    URL.createObjectURL = vi.fn(() => "blob:voice");
    return { play, pause };
  }

  it("plays Gemini's natural voice and can be stopped", async () => {
    const { speak } = stubSpeech();
    const { play, pause } = stubAudio();
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(["wav"]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ReadAloud text="Metformin at 8:00 AM" />);

    await user.click(screen.getByRole("button", { name: "Read aloud" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/tts", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ text: "Metformin at 8:00 AM" });
    expect(play).toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Stop reading" }));
    expect(pause).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Read aloud" })).toBeInTheDocument();
  });

  it("falls back to the browser voice when Gemini is unavailable", async () => {
    const { speak } = stubSpeech();
    stubAudio();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 502 })));
    const user = userEvent.setup();
    render(<ReadAloud text="Aspirin at 9:00 PM" />);

    await user.click(screen.getByRole("button", { name: "Read aloud" }));
    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: "Aspirin at 9:00 PM" }));
    expect(screen.getByRole("button", { name: "Stop reading" })).toBeInTheDocument();
  });
});

describe("DisplayToggles", () => {
  it("turns on larger text: button pressed, <html> class set, choice saved in a cookie", async () => {
    const user = userEvent.setup();
    render(<DisplayToggles initial={DEFAULT_PREFS} />);
    const button = screen.getByRole("button", { name: "Larger text" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await user.click(button);

    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).toHaveClass("large-text");
    expect(document.cookie).toContain("hfy_prefs=largeText%2CreadAloud");

    await user.click(button);
    expect(document.documentElement).not.toHaveClass("large-text");
  });
});
