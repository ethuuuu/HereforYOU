import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/SiteHeader";
import { parsePrefs, prefsClassName, PREFS_COOKIE } from "@/lib/prefs";
import "./globals.css";

// Atkinson Hyperlegible: designed by the Braille Institute for low-vision readers. Self-hosted at build.
const atkinson = Atkinson_Hyperlegible({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-atkinson" });

// The root reads the display-prefs cookie so <html> has the right classes before
// first paint (no flash, no inline script). It's a tiny cookie read, so blocking is fine.
export const instant = false;

export const metadata: Metadata = {
  title: { default: "Here For YOU", template: "%s · Here For YOU" },
  description:
    "A shared health companion for older people: medicine reminders, doctor visits and family support — with you in charge.",
};

export const viewport: Viewport = { themeColor: "#0b5394" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const prefs = parsePrefs((await cookies()).get(PREFS_COOKIE)?.value);

  return (
    <html lang="en" className={`${atkinson.variable} ${prefsClassName(prefs)}`}>
      <body className="flex min-h-screen flex-col font-sans">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <SiteHeader prefs={prefs} />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:py-14">
          {children}
        </main>
        <footer className="no-print border-t-2 border-line bg-warm">
          <div className="mx-auto max-w-5xl px-4 py-8 text-muted">
            <p>Here For YOU helps you remember. It does not replace your doctor or pharmacist.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
