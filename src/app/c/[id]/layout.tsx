import { CircleNav } from "@/components/circle/CircleNav";
import { requireCircleMember } from "@/lib/auth/page";

/** Shared shell for all /c/[id]/* pages. Loads member + circle, provides nav. */
export default async function CircleLayout({ children, params }: LayoutProps<"/c/[id]">) {
  const { id } = await params;
  // requireCircleMember already redirects (signed out) or 404s (not a member).
  const { circle, member } = await requireCircleMember(id);

  const links = [
    { href: `/c/${id}`, label: "Today" },
    { href: `/c/${id}/medications`, label: "Medicines" },
    { href: `/c/${id}/appointments`, label: "Appointments" },
    // Doctors don't see the members list
    ...(member.role === "doctor" ? [] : [{ href: `/c/${id}/members`, label: "Members" }]),
    { href: `/c/${id}/activity`, label: "Activity" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border-t-4 border-gold bg-warm px-5 py-4">
        <p className="font-bold uppercase tracking-wide text-muted">Care circle</p>
        <h1 className="text-3xl font-bold text-primary">{circle.elderName}</h1>
      </div>
      <CircleNav links={links} />
      {children}
    </div>
  );
}
