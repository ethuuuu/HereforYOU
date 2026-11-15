import type { Metadata } from "next";
import { DoseList, type TodayDose } from "@/components/today/DoseList";
import { Card } from "@/components/ui/Card";
import { ReadAloud } from "@/components/ui/ReadAloud";
import { requireCircleMember } from "@/lib/auth/page";
import { can } from "@/lib/auth/permissions";
import { listDoseLogs } from "@/lib/data/doseLogs";
import { listActiveMedications } from "@/lib/data/medications";
import { adherenceStreak, doseState, summarizeAdherence } from "@/lib/domain/adherence";
import { daysOfSupplyLeft, dosesForRange, type DoseInstance } from "@/lib/domain/schedule";
import { addDays, formatLocalDate, formatLocalTime, localDateOf } from "@/lib/domain/time";

export const metadata: Metadata = { title: "Today" };

/** Today: this day's doses, the week's adherence, missed doses and refill warnings. 2 queries. */
export default async function CircleHomePage({ params }: PageProps<"/c/[id]">) {
  const { id } = await params;
  const { circle, member } = await requireCircleMember(id);
  const tz = circle.timezone;
  const now = new Date();
  const today = localDateOf(now, tz);
  const weekStart = addDays(today, -6);

  const [meds, logs] = await Promise.all([listActiveMedications(id), listDoseLogs(id, weekStart, today)]);
  const logById = new Map(logs.map((l) => [l.doseId, l]));
  const weekDoses = dosesForRange(meds, weekStart, today, tz);

  const todayDoses: TodayDose[] = weekDoses
    .filter((d) => d.localDate === today)
    .map((d) => ({
      doseId: d.doseId,
      name: d.medicationName,
      dose: d.dose,
      instructions: d.instructions,
      time: formatLocalTime(d.scheduledAt, tz),
      state: doseState(d, logById.get(d.doseId), now),
    }));

  const byDate = new Map<string, DoseInstance[]>();
  for (const d of weekDoses) byDate.set(d.localDate, [...(byDate.get(d.localDate) ?? []), d]);
  const summary = summarizeAdherence(weekDoses, logs, now);
  const streak = adherenceStreak(byDate, logs, today, now);
  const missed = weekDoses.filter((d) => doseState(d, logById.get(d.doseId), now) === "missed").reverse();
  const refills = meds
    .map((m) => ({ name: m.name, days: daysOfSupplyLeft(m), threshold: m.refillThreshold }))
    .filter((r) => r.days !== null && r.days <= r.threshold);

  const rateText = summary.rate === null ? "No doses yet this week" : `${Math.round(summary.rate * 100)}% taken`;
  const spoken =
    todayDoses.length === 0
      ? "No medicines are scheduled for today."
      : `Today's medicines: ${todayDoses.map((d) => `${d.name}, ${d.dose}, at ${d.time}`).join(". ")}.`;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="today-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="today-heading" className="text-3xl font-bold">
            Today, {formatLocalDate(now, tz)}
          </h2>
          <ReadAloud text={spoken} />
        </div>
        <DoseList circleId={id} doses={todayDoses} canLog={can(member.role, "doses.log")} />
      </section>

      {refills.length > 0 && (
        <section aria-labelledby="refill-heading">
          <Card className="border-danger">
            <h2 id="refill-heading" className="text-2xl font-bold">
              <span aria-hidden="true">! </span>Time to refill
            </h2>
            <ul className="mt-3 flex flex-col gap-1 text-lg" role="list">
              {refills.map((r) => (
                <li key={r.name}>
                  {r.name}: about {r.days} {r.days === 1 ? "day" : "days"} left
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <section aria-labelledby="week-heading">
        <Card>
          <h2 id="week-heading" className="text-2xl font-bold">
            This week
          </h2>
          <dl className="mt-4 grid grid-cols-1 gap-4 text-lg sm:grid-cols-3">
            <div>
              <dt className="text-muted">Taken</dt>
              <dd className="text-2xl font-bold">{rateText}</dd>
            </div>
            <div>
              <dt className="text-muted">Days in a row, all taken</dt>
              <dd className="text-2xl font-bold">{streak}</dd>
            </div>
            <div>
              <dt className="text-muted">Missed</dt>
              <dd className="text-2xl font-bold">{summary.missed}</dd>
            </div>
          </dl>
          {missed.length > 0 && (
            <>
              <h3 className="mt-6 text-xl font-bold">Missed doses</h3>
              <ul className="mt-2 flex flex-col gap-1 text-lg" role="list">
                {missed.slice(0, 10).map((d) => (
                  <li key={d.doseId}>
                    <span aria-hidden="true">! </span>
                    {d.medicationName} — {formatLocalDate(d.scheduledAt, tz)}, {formatLocalTime(d.scheduledAt, tz)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </section>
    </div>
  );
}
