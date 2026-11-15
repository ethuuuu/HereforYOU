import { CircleNav, type NavLink } from "@/components/circle/CircleNav";
import { requireCircleMember } from "@/lib/auth/page";
import { can } from "@/lib/auth/permissions";

/** Shared shell for all /c/[id]/* pages: circle name + section navigation. */
export default async function CircleLayout({ children, params }: LayoutProps<"/c/[id]">) {
  const { id } = await params;
  // requireCircleMember already redirects (signed out) or 404s (not a member).
  const { circle, member } = await requireCircleMember(id);
  const base = `/c/${id}`;

  const links: NavLink[] = [
    { href: base, label: "Today", icon: "today", phone: true },
    { href: `${base}/medications`, label: "Medicines", icon: "medicines", phone: true },
    { href: `${base}/appointments`, label: "Visits", icon: "visits", phone: true },
    ...(can(member.role, "members.view")
      ? [{ href: `${base}/members`, label: "People", icon: "people" as const, phone: true }]
      : []),
    // On phones Activity is reached from the People page, keeping the bottom bar to 4 roomy targets.
    ...(can(member.role, "activity.view")
      ? [{ href: `${base}/activity`, label: "Activity", icon: "activity" as const, phone: false }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="border-l-4 border-accent pl-4">
        <p className="font-bold tracking-wide text-muted uppercase">Care circle</p>
        <h1 className="text-3xl font-bold text-primary sm:text-4xl">{circle.elderName}</h1>
      </div>
      <CircleNav links={links} />
      {children}
    </div>
  );
}
