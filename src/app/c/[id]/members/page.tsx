import type { Metadata } from "next";
import { MembersManager, RotatePasscodeForm } from "@/components/circle/MembersManager";
import { ShareCard } from "@/components/circle/ShareCard";
import { Card } from "@/components/ui/Card";
import { requireCircleMember } from "@/lib/auth/page";
import { assertCan } from "@/lib/auth/permissions";
import { listMembers } from "@/lib/data/members";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage({ params }: PageProps<"/c/[id]/members">) {
  const { id } = await params;
  const { member, circle } = await requireCircleMember(id);
  assertCan(member.role, "members.view");

  const members = await listMembers(id);
  const hasElder = !!circle.elderUid;
  const canManage =
    member.role === "elder" || (member.role === "organiser" && !hasElder);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="members-heading">
        <h2 id="members-heading" className="text-3xl font-bold">
          Members
        </h2>
        <p className="mt-2 text-muted">
          {members.length} {members.length === 1 ? "person" : "people"} in this care circle.
        </p>
      </section>

      <MembersManager
        circleId={id}
        members={members}
        myRole={member.role}
        hasElder={hasElder}
      />

      {/* Invite card */}
      <ShareCard code={circle.code} elderName={circle.elderName} />

      {/* Passcode rotation — elder only (or organiser before claim) */}
      {canManage && (
        <Card>
          <h2 className="mb-4 text-2xl font-bold">Change joining passcode</h2>
          <p className="mb-6 text-muted">
            People with the old passcode can still access the circle. Only new joiners need the new
            one.
          </p>
          <RotatePasscodeForm circleId={id} />
        </Card>
      )}
    </div>
  );
}
