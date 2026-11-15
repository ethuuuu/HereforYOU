"use client";

import { useState } from "react";
import { Dropdown } from "@/components/ui/Dropdown";
import { applyModeInBrowser } from "@/lib/mode";
import { applyPrefsInBrowser, type DisplayPrefs } from "@/lib/prefs";

const OPTIONS = [
  { key: "largeText", label: "Larger text", hint: "Makes all the words bigger" },
  { key: "highContrast", label: "High contrast", hint: "Stronger colours and borders" },
  { key: "bigButtons", label: "Bigger buttons", hint: "Easier to tap" },
  { key: "reduceMotion", label: "Reduce motion", hint: "No sliding or fading" },
  { key: "reduceTransparency", label: "Solid backgrounds", hint: "Turns off the see-through glass" },
] as const;

function Switch({ label, hint, on, onToggle }: { label: string; hint: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex min-h-(--tap) w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-left hover:bg-warm"
    >
      <span>
        <span className="block font-bold">{label}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
      {/* On/Off in words too: never colour alone. */}
      <span className="flex shrink-0 items-center gap-2 font-bold" aria-hidden="true">
        <span className={on ? "text-primary" : "text-muted"}>{on ? "On" : "Off"}</span>
        <span className={`relative h-7 w-12 rounded-full border-2 elder:h-8 elder:w-14 ${on ? "border-primary bg-primary" : "border-field bg-bg"}`}>
          <span
            className={`absolute top-1/2 size-4 -translate-y-1/2 rounded-full transition-[left] duration-200 elder:size-5 ${on ? "left-6 bg-on-primary elder:left-7" : "left-1 bg-field"}`}
          />
        </span>
      </span>
    </button>
  );
}

/** Header "Accessibility" menu: switches saved in cookies so every page loads that way. */
export function AccessibilityMenu({
  initial,
  initialElderMode = false,
  className,
}: {
  initial: DisplayPrefs;
  initialElderMode?: boolean;
  className?: string;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [elderMode, setElderMode] = useState(initialElderMode);

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
        <li className="border-b-2 border-line pb-1">
          <Switch
            label="Simple large layout"
            hint="Bigger words and buttons, calmer movement"
            on={elderMode}
            onToggle={() => {
              applyModeInBrowser(!elderMode);
              setElderMode(!elderMode);
            }}
          />
        </li>
        {OPTIONS.map(({ key, label, hint }) => (
          <li key={key}>
            <Switch label={label} hint={hint} on={prefs[key]} onToggle={() => toggle(key)} />
          </li>
        ))}
      </ul>
      <p className="mt-2 px-3 pb-1 text-sm text-muted">Light or dark follows your device setting.</p>
    </Dropdown>
  );
}
