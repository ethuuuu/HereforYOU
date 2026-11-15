---
name: accessibility
description: Elder-first accessible UI rules for Here For YOU — large text mode, touch targets, contrast, focus, live regions, read-aloud, plain language and form errors. Use whenever building or changing any page, component, form, button, dialog, email layout or visual style.
---

# Accessibility (elders are the primary users)

Checklist for every UI change:
- Text in `rem`; base 18px; large-text mode ≥ 22px (class on `<html>`). Line height ≥ 1.5.
- Targets ≥ 48×48px; spacing ≥ 8px between targets; primary action full-width on mobile.
- Contrast ≥ 4.5:1 (high-contrast mode ≥ 7:1). Status = icon + word, never colour alone.
- One `h1`; headings in order; landmarks `header/nav/main/footer`; skip link to `#main`.
- Every input has a visible `<label>`; hints and errors via `aria-describedby`; errors say how to fix ("Enter time like 8:00 AM").
- Buttons are `<button>`, links are `<a>`. Icons have `aria-hidden` + visible text or `aria-label`.
- Focus ring visible (`focus-visible:outline-4`); dialogs trap focus and return it; Esc closes.
- Results, toasts, AI output → `aria-live="polite"`; destructive confirms → clear wording ("Remove Priya from Asha's circle?").
- `prefers-reduced-motion` respected. No auto-playing anything. No timeouts on forms.
- Read-aloud (`speechSynthesis`) on Today and AI results; stop button while speaking.
- Plain words: "Medicines", "Taken", "Missed", "Doctor visits". Times "8:00 AM", dates "Sat, 15 Nov".
- Test with keyboard only once per page; Lighthouse accessibility ≥ 95.
