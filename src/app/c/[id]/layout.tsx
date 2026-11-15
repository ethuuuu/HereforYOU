import Link from "next/link";
import { requireCircleMember } from "@/lib/auth/page";

/** Shared shell for all /c/[id]/* pages. Loads member + circle, provides nav. */
export default async function CircleLayout({ children, params }: LayoutProps<"/c/[id]">) {
  const { id } = await params;
  // requireCircleMember already redirects (signed out) or 404s (not a member).
  const { circle, member } = await requireCircleMember(id);

  const NAV_LINKS = [
    { href: `/c/${id}`, label: "Today" },
    { href: `/c/${id}/medications`, label: "Medicines" },
    { href: `/c/${id}/appointments`, label: "Appointments" },
    { href: `/c/${id}/members`, label: "Members" },
    { href: `/c/${id}/activity`, label: "Activity" },
  ];

  // Doctors don't see the members list
  const visibleLinks = NAV_LINKS.filter(
    (l) => !(l.label === "Members" && member.role === "doctor"),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Circle identity bar */}
      <div className="rounded-2xl bg-warm px-5 py-4">
        <p className="text-sm font-bold uppercase tracking-wide text-muted">Care circle</p>
        <h1 className="text-2xl font-bold text-primary">{circle.elderName}</h1>
      </div>

      {/* Circle nav */}
      <nav aria-label="Circle sections">
        <ul className="flex flex-wrap gap-2" role="list">
          {visibleLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-flex min-h-11 items-center rounded-2xl border-2 border-primary px-4 py-2 text-base font-bold text-primary no-underline transition-colors hover:bg-warm"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {children}
    </div>
  );
}
