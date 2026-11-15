import Link from "next/link";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/Button";
import { DisplayToggles } from "@/components/DisplayToggles";
import { getSessionUser } from "@/lib/auth/session";
import type { DisplayPrefs } from "@/lib/prefs";

/** Checking the session is a network call, so it streams in without holding up the page. */
async function HeaderUser() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <Link href="/signin" className={buttonClass("secondary")}>
        Sign in
      </Link>
    );
  }
  return (
    <p>
      Signed in as <strong>{user.name ?? user.email ?? "you"}</strong>
    </p>
  );
}

export function SiteHeader({ prefs }: { prefs: DisplayPrefs }) {
  return (
    <header className="no-print border-b-2 border-line bg-bg">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="text-2xl font-bold text-primary no-underline">
          Here For YOU
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <DisplayToggles initial={prefs} />
          <Suspense fallback={null}>
            <HeaderUser />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
