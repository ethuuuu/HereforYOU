import type { Metadata } from "next";
import { MedicationForm } from "@/components/medications/MedicationForm";
import { MedsNotAllowed } from "@/components/medications/MedsNotAllowed";
import { requireCircleMember } from "@/lib/auth/page";
import { assertCan, canEditMedicines } from "@/lib/auth/permissions";
import { localDateOf } from "@/lib/domain/time";

export const metadata: Metadata = { title: "Add a medicine" };

export default async function NewMedicationPage({ params }: PageProps<"/c/[id]/medications/new">) {
  const { id } = await params;
  const { member, circle } = await requireCircleMember(id);
  assertCan(member.role, "medications.edit");
  return (
    <section aria-labelledby="new-med-heading" className="flex flex-col gap-6">
      <h2 id="new-med-heading" className="text-3xl font-bold">
        Add a medicine
      </h2>
      {canEditMedicines(member) ? (
        <MedicationForm circleId={id} today={localDateOf(new Date(), circle.timezone)} />
      ) : (
        <MedsNotAllowed circle={circle} />
      )}
    </section>
  );
}
