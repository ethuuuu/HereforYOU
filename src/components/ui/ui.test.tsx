// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccessibilityMenu } from "@/components/AccessibilityMenu";
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
  document.cookie = "hfy_mode=; Max-Age=0; Path=/";
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

describe("AccessibilityMenu", () => {
  it("opens, switches settings on and off, applies <html> classes and saves a cookie", async () => {
    const user = userEvent.setup();
    render(<AccessibilityMenu initial={DEFAULT_PREFS} />);
    const menu = screen.getByRole("button", { name: "Accessibility" });
    expect(menu).toHaveAttribute("aria-expanded", "false");

    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    const larger = screen.getByRole("switch", { name: /Larger text/ });
    expect(larger).toHaveAttribute("aria-checked", "false");

    await user.click(larger);
    await user.click(screen.getByRole("switch", { name: /Reduce motion/ }));
    await user.click(screen.getByRole("switch", { name: /Bigger buttons/ }));
    await user.click(screen.getByRole("switch", { name: /Solid backgrounds/ }));
    expect(larger).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveClass("large-text", "reduce-motion", "big-buttons", "reduce-transparency");
    expect(document.cookie).toContain("hfy_prefs=largeText%2CreduceMotion%2CbigButtons%2CreduceTransparency%2CreadAloud");

    await user.click(larger);
    expect(document.documentElement).not.toHaveClass("large-text");
  });

  it("lets anyone switch the simple large layout (elder mode) on and off", async () => {
    const user = userEvent.setup();
    render(<AccessibilityMenu initial={DEFAULT_PREFS} initialElderMode />);
    await user.click(screen.getByRole("button", { name: "Accessibility" }));
    const simple = screen.getByRole("switch", { name: /Simple large layout/ });
    expect(simple).toHaveAttribute("aria-checked", "true");

    await user.click(simple);
    expect(simple).toHaveAttribute("aria-checked", "false");
    expect(document.documentElement).not.toHaveClass("elder-mode");
    expect(document.cookie).toContain("hfy_mode=standard");

    await user.click(simple);
    expect(document.documentElement).toHaveClass("elder-mode");
    expect(document.cookie).toContain("hfy_mode=elder");
  });

  it("closes on Escape and returns focus to the Accessibility button", async () => {
    const user = userEvent.setup();
    render(<AccessibilityMenu initial={DEFAULT_PREFS} />);
    const menu = screen.getByRole("button", { name: "Accessibility" });
    await user.click(menu);
    await user.keyboard("{Escape}");
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("switch")).toBeNull();
    expect(menu).toHaveFocus();
  });
});

