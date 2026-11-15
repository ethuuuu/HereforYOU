/**
 * UI mode: "elder" (large, calm, simple — 18px base, 48px+ targets) or "standard"
 * (a normal, fluid UI for family, caretakers, doctors and visitors).
 * A small readable cookie, set at sign-in from users/{uid}.setupRole, so the root layout
 * can pick the mode without a Firestore read. Anyone can switch it in the Accessibility menu.
 * Shared by server and browser code — keep it free of server-only imports.
 */
export const MODE_COOKIE = "hfy_mode";
export const ELDER_CLASS = "elder-mode";
const MAX_AGE = 31536000; // one year

export const isElderMode = (value: string | undefined): boolean => value === "elder";

/** Server: options for `cookies().set(...)`. Not secret, so not httpOnly. */
export const modeCookie = (elder: boolean) => ({
  name: MODE_COOKIE,
  value: elder ? "elder" : "standard",
  path: "/",
  maxAge: MAX_AGE,
  sameSite: "lax" as const,
});

/** Browser only: save the mode and apply it to <html> right away. */
export function applyModeInBrowser(elder: boolean): void {
  const c = modeCookie(elder);
  document.cookie = `${c.name}=${c.value}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`;
  document.documentElement.classList.toggle(ELDER_CLASS, elder);
}
