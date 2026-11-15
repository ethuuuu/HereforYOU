"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavIcon = "today" | "medicines" | "visits" | "people" | "activity";
export type NavLink = { href: string; label: string; icon: NavIcon; phone: boolean };

// Simple line icons (no icon library needed); always shown with a text label.
const PATHS: Record<NavIcon, string> = {
  today: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  medicines: "M8.5 15.5l7-7a3.5 3.5 0 0 0-5-5l-7 7a3.5 3.5 0 0 0 5 5zM7 7l5 5",
  visits: "M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  people: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6",
  activity: "M4 4h16v16H4zM8 9h8M8 13h8M8 17h5",
};

function Icon({ name }: { name: NavIcon }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}

/**
 * Circle sections. Wide screens: underlined text tabs under the circle name.
 * Phones: a fixed bottom bar with big icon + label targets (thumb-reachable).
 * The current section is marked with aria-current and a thick bar — not colour alone.
 */
export function CircleNav({ links }: { links: NavLink[] }) {
  const path = usePathname();
  // The first link is the circle root, so it only matches exactly; others also match sub-pages.
  const isCurrent = (href: string, i: number) => (i === 0 ? path === href : path === href || path.startsWith(`${href}/`));

  return (
    <>
      <nav aria-label="Circle sections" className="hidden border-b-2 border-line sm:block">
        <ul className="flex gap-1" role="list">
          {links.map((link, i) => {
            const current = isCurrent(link.href, i);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  className={`-mb-0.5 inline-flex min-h-(--tap) items-center border-b-4 px-4 font-bold no-underline ${
                    current ? "border-primary text-primary" : "border-transparent text-muted hover:border-line hover:text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav aria-label="Circle sections" className="bottom-nav no-print glass fixed inset-x-0 bottom-0 z-30 border-t-2 border-line sm:hidden">
        <ul className="grid auto-cols-fr grid-flow-col" role="list">
          {links.map((link, i) =>
            link.phone ? (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isCurrent(link.href, i) ? "page" : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center gap-0.5 border-t-4 px-1 pt-1 pb-2 text-center leading-tight font-bold no-underline hyphens-auto ${
                    isCurrent(link.href, i) ? "border-primary text-primary" : "border-transparent text-muted"
                  }`}
                >
                  <Icon name={link.icon} />
                  {link.label}
                </Link>
              </li>
            ) : null,
          )}
        </ul>
      </nav>
    </>
  );
}
