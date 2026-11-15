import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { requireCircleMember } from "@/lib/auth/page";
import { assertCan, can } from "@/lib/auth/permissions";
import { listMedications } from "@/lib/data/medications";
import { daysOfSupplyLeft } from "@/lib/domain/schedule";
import { formatLocalTime, localDateOf, zonedToUtc } from "@/lib/domain/time";

export const metadata: Metadata = { title: "Medicines" };

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function MedicationsPage({ params }: PageProps<"/c/[id]/medications">) {
  const { id } = await params;
  const { member, circle } = await requireCircleMember(id);
  assertCan(member.role, "medications.view");
  const canEdit = can(member.role, "medications.edit");
  const tz = circle.timezone;
  const today = localDateOf(new Date(), tz);
  const meds = (await listMedications(id)).sort((a, b) => Number(b.active) - Number(a.active));
  const timeLabel = (t: string) => formatLocalTime(zonedToUtc(today, t, tz), tz);

  return (
    <section aria-labelledby="meds-heading" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="meds-heading" className="text-3xl font-bold">
          Medicines
        </h2>
        {canEdit && (
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href={`/c/${id}/medications/new`} className={buttonClass("primary")}>
              Add a medicine
            </Link>
            {can(member.role, "ai.use") && (
              <Link href={`/c/${id}/medications/import`} className={buttonClass("secondary")}>
                Add from prescription
              </Link>
            )}
          </div>
        )}
      </div>

      {meds.length === 0 && (
        <p className="text-lg text-muted">
          No medicines yet.
          {canEdit ? " Add the first one above." : " The elder, a caretaker or a doctor can add them."}
        </p>
      )}

      <ul className="stagger flex flex-col gap-4" role="list">
        {meds.map((m) => {
          const daysLeft = daysOfSupplyLeft(m);
          const lowSupply = m.active && daysLeft !== null && daysLeft <= m.refillThreshold;
          return (
            <li key={m.id}>
              <Card className={m.active ? "" : "opacity-80"}>
                <h3 className="text-2xl font-bold">
                  {m.name} <span className="font-normal">· {m.dose}</span>
                </h3>
                {!m.active && <p className="font-bold text-muted">Stopped</p>}
                {m.purpose && <p className="text-lg">For {m.purpose}</p>}
                <p className="text-lg">
                  {m.times.map(timeLabel).join(", ")}
                  {m.daysOfWeek.length < 7 && ` on ${m.daysOfWeek.map((d) => DAY_NAMES[d]).join(", ")}`}
                  {m.instructions && ` — ${m.instructions}`}
                </p>
                {m.pillsRemaining !== undefined && (
                  <p className={lowSupply ? "font-bold text-danger" : "text-muted"}>
                    {lowSupply && <span aria-hidden="true">! </span>}
                    {m.pillsRemaining} pills left{daysLeft !== null && ` (about ${daysLeft} days)`}
                    {lowSupply && " — time to refill"}
                  </p>
                )}
                {m.prescribedBy && <p className="text-muted">Prescribed by {m.prescribedBy}</p>}
                {canEdit && (
                  <Link href={`/c/${id}/medications/${m.id}`} className={buttonClass("secondary", "mt-4")}>
                    Edit {m.name}
                  </Link>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
