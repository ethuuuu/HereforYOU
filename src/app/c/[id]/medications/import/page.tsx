import type { Metadata } from "next";
import { PrescriptionImport } from "@/components/medications/PrescriptionImport";
import { requireCircleMember } from "@/lib/auth/page";
import { assertCan } from "@/lib/auth/permissions";
import { localDateOf } from "@/lib/domain/time";

export const metadata: Metadata = { title: "Add from prescription" };

export default async function ImportPrescriptionPage({ params }: PageProps<"/c/[id]/medications/import">) {
  const { id } = await params;
  const { member, circle } = await requireCircleMember(id);
  assertCan(member.role, "medications.edit");
  assertCan(member.role, "ai.use");
  return (
    <section aria-labelledby="import-heading" className="flex flex-col gap-6">
      <h2 id="import-heading" className="text-3xl font-bold">
        Add from a prescription
      </h2>
      <p className="text-lg">
        Paste the prescription or add a photo. We&apos;ll suggest the medicines and times — you check them and choose what to save.
      </p>
      <PrescriptionImport circleId={id} today={localDateOf(new Date(), circle.timezone)} />
    </section>
  );
}
