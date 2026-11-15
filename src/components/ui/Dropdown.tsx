"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Accessible disclosure menu for the header: a labelled button that opens a panel.
 * Escape closes it and returns focus to the button; a tap outside closes it.
 */
export function Dropdown({
  label,
  icon,
  panelLabel,
  className = "",
  children,
}: {
  label: string;
  icon?: ReactNode;
  panelLabel: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="inline-flex min-h-(--tap) w-full items-center justify-center gap-2 rounded-lg border-2 border-primary bg-surface px-4 font-bold text-primary hover:bg-warm aria-expanded:bg-warm"
      >
        {icon}
        {label}
        <span aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={panelLabel}
          className="animate-pop absolute right-0 z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-lg border-2 border-line bg-surface p-3 shadow-xl"
        >
          {children}
        </div>
      )}
    </div>
  );
}
