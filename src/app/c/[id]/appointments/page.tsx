import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { VisitQuestions } from "@/components/appointments/VisitQuestions";
import { buttonClass } from "@/components/ui/Button";
import { requireCircleMember } from "@/lib/auth/page";
import { assertCan, can } from "@/lib/auth/permissions";
import { listAppointmentsBetween, listPastAppointments } from "@/lib/data/appointments";

export const metadata: Metadata = { title: "Appointments" };

/** Upcoming visits (soonest first) and recent past ones. 2 queries. */
export default async function AppointmentsPage({ params }: PageProps<"/c/[id]/appointments">) {
  const { id } = await params;
  const { member, circle } = await requireCircleMember(id);
  assertCan(member.role, "appointments.view");
  const canEdit = can(member.role, "appointments.edit");
  const canAsk = canEdit && can(member.role, "ai.use");
  const nowIso = new Date().toISOString();
  const [upcoming, past] = await Promise.all([listAppointmentsBetween(id, nowIso), listPastAppointments(id, nowIso)]);
  const card = (a: (typeof upcoming)[number], ask = false) => (
    <li key={a.id}>
      <AppointmentCard appointment={a} timeZone={circle.timezone} editHref={canEdit ? `/c/${id}/appointments/${a.id}` : undefined}>
        {ask && <VisitQuestions circleId={id} apptId={a.id} doctorName={a.doctorName} />}
      </AppointmentCard>
    </li>
  );

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="upcoming-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="upcoming-heading" className="text-3xl font-bold">
            Upcoming appointments
          </h2>
          {canEdit && (
            <Link href={`/c/${id}/appointments/new`} className={buttonClass("primary")}>
              Add an appointment
            </Link>
          )}
        </div>
        {upcoming.length === 0 && (
          <p className="text-lg text-muted">
            No upcoming appointments.
            {canEdit ? "" : " The elder, a caretaker or a doctor can add them."}
          </p>
        )}
        <ul className="stagger flex flex-col gap-4" role="list">
          {upcoming.map((a) => card(a, canAsk))}
        </ul>
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past-heading" className="flex flex-col gap-4">
          <h2 id="past-heading" className="text-2xl font-bold">
            Past appointments
          </h2>
          <ul className="stagger flex flex-col gap-4" role="list">
            {past.map((a) => card(a))}
          </ul>
        </section>
      )}
    </div>
  );
}
