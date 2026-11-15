"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";

type State = "idle" | "loading" | "playing";

// Same text → same audio for the rest of the visit, so pressing again doesn't call Gemini again.
const cache = new Map<string, string>();

/** Natural Gemini voice from /api/tts as a blob: URL, or null if unavailable (signed out, offline, error). */
async function geminiAudio(text: string, signal: AbortSignal): Promise<string | null> {
  const hit = cache.get(text);
  if (hit) return hit;
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });
    if (!res.ok) return null;
    const url = URL.createObjectURL(await res.blob());
    cache.set(text, url);
    return url;
  } catch {
    return null;
  }
}

/** Reads `text` aloud in Gemini's natural voice, falling back to the browser's own voice. */
export function ReadAloud({ text, label = "Read aloud" }: { text: string; label?: string }) {
  const [state, setState] = useState<State>("idle");
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => () => stopRef.current(), []);

  function stop() {
    stopRef.current();
    stopRef.current = () => {};
    setState("idle");
  }

  function speakWithBrowser() {
    if (!("speechSynthesis" in window)) return setState("idle");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en";
    utterance.rate = 0.9; // a little slower is easier to follow
    utterance.onend = () => setState("idle");
    utterance.onerror = () => setState("idle");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setState("playing");
  }

  async function start() {
    const controller = new AbortController();
    // Created inside the click so Safari/iOS still count playback as user-started after the fetch.
    const audio = new Audio();
    stopRef.current = () => {
      controller.abort();
      audio.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
    setState("loading");

    const url = await geminiAudio(text, controller.signal);
    if (controller.signal.aborted) return;
    if (url) {
      audio.src = url;
      audio.onended = () => setState("idle");
      try {
        await audio.play();
        setState("playing");
        return;
      } catch {
        // Playback refused (autoplay rules, codec): use the browser voice instead.
      }
    }
    speakWithBrowser();
  }

  return (
    <Button variant="secondary" onClick={state === "idle" ? start : stop} aria-busy={state === "loading" || undefined}>
      <span aria-hidden="true">{state === "idle" ? "🔊" : "■"}</span>
      {state === "idle" ? label : state === "loading" ? "Preparing voice… (press to cancel)" : "Stop reading"}
    </Button>
  );
}
