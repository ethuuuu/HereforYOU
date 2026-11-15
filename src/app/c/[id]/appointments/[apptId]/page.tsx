import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppointmentForm } from "@/components/appointments/AppointmentForm";
import { requireCircleMember } from "@/lib/auth/page";
import { assertCan } from "@/lib/auth/permissions";
import { getAppointment } from "@/lib/data/appointments";
import { localDateOf } from "@/lib/domain/time";
import { isSafeId } from "@/lib/http";

export const metadata: Metadata = { title: "Edit appointment" };

export default async function EditAppointmentPage({ params }: PageProps<"/c/[id]/appointments/[apptId]">) {
  const { id, apptId } = await params;
  const { member, circle } = await requireCircleMember(id);
  assertCan(member.role, "appointments.edit");
  const appt = isSafeId(apptId) ? await getAppointment(id, apptId) : null;
  if (!appt) notFound();
  return (
    <section aria-labelledby="edit-appt-heading" className="flex flex-col gap-6">
      <h2 id="edit-appt-heading" className="text-3xl font-bold">
        Edit visit with {appt.doctorName}
      </h2>
      <p className="text-lg text-muted">Times are in {circle.timezone} time.</p>
      <AppointmentForm circleId={id} appointment={appt} today={localDateOf(new Date(), circle.timezone)} />
    </section>
  );
}
