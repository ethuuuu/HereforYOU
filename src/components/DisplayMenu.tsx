"use client";

import { useEffect, useId, useRef, useState } from "react";
import { applyPrefsInBrowser, type DisplayPrefs } from "@/lib/prefs";

const OPTIONS = [
  { key: "largeText", label: "Larger text", hint: "Makes all the words bigger" },
  { key: "highContrast", label: "High contrast", hint: "Stronger colours and borders" },
  { key: "bigButtons", label: "Bigger buttons", hint: "Easier to tap" },
  { key: "reduceMotion", label: "Reduce motion", hint: "No sliding or fading" },
] as const;

/**
 * "Display" dropdown in the header: switches for text size, contrast, button size and motion.
 * Saved in a cookie so every page loads that way. Light/dark follows the device setting.
 */
export function DisplayMenu({ initial }: { initial: DisplayPrefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape (focus back to the button) or a tap outside the menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  function toggle(key: (typeof OPTIONS)[number]["key"]) {
    const next = { ...prefs, [key]: !prefs[key] };
    applyPrefsInBrowser(next);
    setPrefs(next);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="inline-flex min-h-(--tap) items-center gap-2 rounded-2xl border-2 border-primary px-4 font-bold text-primary hover:bg-warm aria-expanded:bg-warm"
      >
        <span aria-hidden="true">Aa</span>
        Display
        <span aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="Display settings"
          className="animate-pop absolute left-0 z-30 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-3xl border-2 border-line bg-surface p-3 shadow-xl sm:right-0 sm:left-auto"
        >
          <ul className="flex flex-col gap-1" role="list">
            {OPTIONS.map(({ key, label, hint }) => (
              <li key={key}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs[key]}
                  onClick={() => toggle(key)}
                  className="flex min-h-(--tap) w-full items-center justify-between gap-4 rounded-2xl px-3 py-2 text-left hover:bg-warm"
                >
                  <span>
                    <span className="block font-bold">{label}</span>
                    <span className="block text-muted">{hint}</span>
                  </span>
                  {/* Switch shows On/Off in words too: never colour alone. */}
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
        </div>
      )}
    </div>
  );
}
