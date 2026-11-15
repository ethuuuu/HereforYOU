"use client";

import { useState } from "react";
import { Dropdown } from "@/components/ui/Dropdown";
import { applyPrefsInBrowser, type DisplayPrefs } from "@/lib/prefs";

const OPTIONS = [
  { key: "largeText", label: "Larger text", hint: "Makes all the words bigger" },
  { key: "highContrast", label: "High contrast", hint: "Stronger colours and borders" },
  { key: "bigButtons", label: "Bigger buttons", hint: "Easier to tap" },
  { key: "reduceMotion", label: "Reduce motion", hint: "No sliding or fading" },
] as const;

/** Header "Accessibility" menu: switches saved in a cookie so every page loads that way. */
export function AccessibilityMenu({ initial, className }: { initial: DisplayPrefs; className?: string }) {
  const [prefs, setPrefs] = useState(initial);

  function toggle(key: (typeof OPTIONS)[number]["key"]) {
    const next = { ...prefs, [key]: !prefs[key] };
    applyPrefsInBrowser(next);
    setPrefs(next);
  }

  return (
    <Dropdown
      label="Accessibility"
      panelLabel="Accessibility settings"
      className={className}
      icon={
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="currentColor">
          <circle cx="12" cy="4" r="2" />
          <path d="M4 7.5h16v2h-5.5v4l2.5 7.5h-2.2L12 15l-2.8 6H7l2.5-7.5v-4H4z" />
        </svg>
      }
    >
      <ul className="flex flex-col gap-1" role="list">
        {OPTIONS.map(({ key, label, hint }) => (
          <li key={key}>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[key]}
              onClick={() => toggle(key)}
              className="flex min-h-(--tap) w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-left hover:bg-warm"
            >
              <span>
                <span className="block font-bold">{label}</span>
                <span className="block text-muted">{hint}</span>
              </span>
              {/* On/Off in words too: never colour alone. */}
              <span className="flex shrink-0 items-center gap-2 font-bold" aria-hidden="true">
                <span className={prefs[key] ? "text-primary" : "text-muted"}>{prefs[key] ? "On" : "Off"}</span>
                <span
                  className={`relative h-8 w-14 rounded-full border-2 ${prefs[key] ? "border-primary bg-primary" : "border-field bg-bg"}`}
                >
                  <span
                    className={`absolute top-1/2 size-5 -translate-y-1/2 rounded-full transition-[left] ${prefs[key] ? "left-7 bg-on-primary" : "left-1 bg-field"}`}
                  />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 px-3 pb-1 text-muted">Light or dark follows your device setting.</p>
    </Dropdown>
  );
}
