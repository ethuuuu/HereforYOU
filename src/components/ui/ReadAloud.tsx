"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "./Button";

const subscribe = () => () => {};
const hasSpeech = () => "speechSynthesis" in window;

/** Reads `text` out loud with the browser's voice. Hidden where speech isn't supported. */
export function ReadAloud({ text, label = "Read aloud" }: { text: string; label?: string }) {
  const supported = useSyncExternalStore(subscribe, hasSpeech, () => false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  if (!supported) return null;

  function toggle() {
    const synth = window.speechSynthesis;
    synth.cancel();
    if (speaking) {
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en";
    utterance.rate = 0.9; // a little slower is easier to follow
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synth.speak(utterance);
    setSpeaking(true);
  }

  return (
    <Button variant="secondary" onClick={toggle}>
      <span aria-hidden="true">{speaking ? "■" : "🔊"}</span>
      {speaking ? "Stop reading" : label}
    </Button>
  );
}
