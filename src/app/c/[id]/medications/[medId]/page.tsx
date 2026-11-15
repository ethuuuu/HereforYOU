import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MedicationForm } from "@/components/medications/MedicationForm";
import { requireCircleMember } from "@/lib/auth/page";
import { assertCan } from "@/lib/auth/permissions";
import { getMedication } from "@/lib/data/medications";
import { localDateOf } from "@/lib/domain/time";
import { isSafeId } from "@/lib/http";

export const metadata: Metadata = { title: "Edit medicine" };

export default async function EditMedicationPage({ params }: PageProps<"/c/[id]/medications/[medId]">) {
  const { id, medId } = await params;
  const { member, circle } = await requireCircleMember(id);
  assertCan(member.role, "medications.edit");
  const med = isSafeId(medId) ? await getMedication(id, medId) : null;
  if (!med) notFound();
  return (
    <section aria-labelledby="edit-med-heading" className="flex flex-col gap-6">
      <h2 id="edit-med-heading" className="text-3xl font-bold">
        Edit {med.name}
      </h2>
      <MedicationForm circleId={id} medication={med} today={localDateOf(new Date(), circle.timezone)} />
    </section>
  );
}
