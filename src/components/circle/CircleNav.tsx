"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE = "inline-flex min-h-(--tap) items-center rounded-full border-2 border-primary px-4 py-2 text-base font-bold no-underline transition-colors";

/** Circle section tabs. The current section is filled in and announced with aria-current. */
export function CircleNav({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  // "Today" is the circle root, so it only matches exactly; other sections also match their sub-pages.
  const isCurrent = (href: string, i: number) => (i === 0 ? path === href : path === href || path.startsWith(`${href}/`));
  return (
    <nav aria-label="Circle sections">
      <ul className="flex flex-wrap gap-2" role="list">
        {links.map((link, i) => {
          const current = isCurrent(link.href, i);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={`${BASE} ${current ? "bg-primary text-on-primary" : "text-primary hover:bg-warm"}`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
