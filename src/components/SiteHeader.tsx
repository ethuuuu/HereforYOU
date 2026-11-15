import Link from "next/link";
import { Suspense } from "react";
import { AccessibilityMenu } from "@/components/AccessibilityMenu";
import { AccountMenu } from "@/components/AccountMenu";
import { buttonClass } from "@/components/ui/Button";
import { getSessionUser } from "@/lib/auth/session";
import type { DisplayPrefs } from "@/lib/prefs";

async function HeaderUser() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <Link href="/signin" className={buttonClass("primary", "w-auto!")}>
        Sign in
      </Link>
    );
  }
  return <AccountMenu name={user.name ?? user.email ?? "you"} />;
}

/**
 * Phones: brand + Account on one row, a full-width Accessibility button below.
 * Wider screens: everything on one row.
 */
export function SiteHeader({ prefs }: { prefs: DisplayPrefs }) {
  return (
    <header className="no-print border-b-2 border-line bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-primary no-underline">
          <span aria-hidden="true" className="grid size-9 place-items-center rounded-lg bg-primary text-lg text-on-primary">
            ♥
          </span>
          Here For YOU
        </Link>
        <div className="flex items-center gap-3 sm:order-last">
          <Suspense fallback={null}>
            <HeaderUser />
          </Suspense>
        </div>
        <AccessibilityMenu initial={prefs} className="order-last w-full sm:order-none sm:ml-auto sm:w-auto" />
      </div>
    </header>
  );
}
