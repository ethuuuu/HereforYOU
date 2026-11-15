/**
 * Display preferences (large text, high contrast, reduce motion, big buttons, read-aloud).
 * Stored in a small readable cookie so the server can put the right classes on <html>
 * before first paint. Signed-in users' saved prefs are copied into it at sign-in.
 * Shared by server and browser code — keep it free of server-only imports.
 */
export const PREFS_COOKIE = "hfy_prefs";

export type DisplayPrefs = {
  largeText: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  bigButtons: boolean;
  readAloud: boolean;
};
type PrefKey = keyof DisplayPrefs;

export const DEFAULT_PREFS: DisplayPrefs = {
  largeText: false,
  highContrast: false,
  reduceMotion: false,
  bigButtons: false,
  readAloud: true,
};

const KEYS = Object.keys(DEFAULT_PREFS) as PrefKey[];
const CLASS: Partial<Record<PrefKey, string>> = {
  largeText: "large-text",
  highContrast: "high-contrast",
  reduceMotion: "reduce-motion",
  bigButtons: "big-buttons",
};

/** Cookie value is the comma-separated list of prefs that are ON, e.g. "largeText,readAloud". */
export function parsePrefs(value: string | undefined): DisplayPrefs {
  if (value === undefined) return { ...DEFAULT_PREFS };
  const on = new Set(decodeURIComponent(value).split(","));
  return Object.fromEntries(KEYS.map((k) => [k, on.has(k)])) as DisplayPrefs;
}

export function serializePrefs(prefs: DisplayPrefs): string {
  return KEYS.filter((k) => prefs[k]).join(",");
}

/** Classes for <html>, e.g. "large-text high-contrast". */
export function prefsClassName(prefs: DisplayPrefs): string {
  return KEYS.flatMap((k) => (prefs[k] && CLASS[k] ? [CLASS[k]] : [])).join(" ");
}

/** Browser only: persist prefs for a year. Not secret, so not httpOnly. */
export function prefsCookieString(prefs: DisplayPrefs): string {
  return `${PREFS_COOKIE}=${encodeURIComponent(serializePrefs(prefs))}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** Browser only: the prefs saved on this device. */
export function readPrefsInBrowser(): DisplayPrefs {
  const match = document.cookie.match(new RegExp(`(?:^|; )${PREFS_COOKIE}=([^;]*)`));
  return parsePrefs(match?.[1]);
}

/** Browser only: save prefs and apply them to <html> right away. */
export function applyPrefsInBrowser(prefs: DisplayPrefs): void {
  document.cookie = prefsCookieString(prefs);
  const html = document.documentElement;
  for (const k of KEYS) if (CLASS[k]) html.classList.toggle(CLASS[k], prefs[k]);
}
