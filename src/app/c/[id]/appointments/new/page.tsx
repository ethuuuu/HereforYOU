import type { Metadata } from "next";
import { AppointmentForm } from "@/components/appointments/AppointmentForm";
import { requireCircleMember } from "@/lib/auth/page";
import { assertCan } from "@/lib/auth/permissions";
import { localDateOf } from "@/lib/domain/time";

export const metadata: Metadata = { title: "Add an appointment" };

export default async function NewAppointmentPage({ params }: PageProps<"/c/[id]/appointments/new">) {
  const { id } = await params;
  const { member, circle } = await requireCircleMember(id);
  assertCan(member.role, "appointments.edit");
  return (
    <section aria-labelledby="new-appt-heading" className="flex flex-col gap-6">
      <h2 id="new-appt-heading" className="text-3xl font-bold">
        Add an appointment
      </h2>
      <p className="text-lg text-muted">Times are in {circle.timezone} time.</p>
      <AppointmentForm circleId={id} today={localDateOf(new Date(), circle.timezone)} />
    </section>
  );
}
