"use client";

import { useState } from "react";
import { applyPrefsInBrowser, type DisplayPrefs } from "@/lib/prefs";

const TOGGLES = [
  { key: "largeText", label: "Larger text" },
  { key: "highContrast", label: "High contrast" },
] as const;

/** Header switches for text size and contrast. Saved in a cookie so every page loads that way. */
export function DisplayToggles({ initial }: { initial: DisplayPrefs }) {
  const [prefs, setPrefs] = useState(initial);

  function toggle(key: (typeof TOGGLES)[number]["key"]) {
    const next = { ...prefs, [key]: !prefs[key] };
    applyPrefsInBrowser(next);
    setPrefs(next);
  }

  return (
    <div role="group" aria-label="Display settings" className="flex flex-wrap gap-2">
      {TOGGLES.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          aria-pressed={prefs[key]}
          onClick={() => toggle(key)}
          className="min-h-12 rounded-2xl border-2 border-primary px-4 font-bold text-primary aria-pressed:bg-primary aria-pressed:text-on-primary"
        >
          <span aria-hidden="true">{prefs[key] ? "✓ " : ""}</span>
          {label}
        </button>
      ))}
    </div>
  );
}
