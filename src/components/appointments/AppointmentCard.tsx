import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { googleCalendarUrl, googleMapsUrl } from "@/lib/calendar";
import type { Appointment } from "@/lib/domain/schemas";
import { formatLocalDate, formatLocalTime } from "@/lib/domain/time";

type Props = { appointment: Appointment; timeZone: string; editHref?: string; headingLevel?: "h2" | "h3" };

/** One visit: when, where, why — with Google Calendar and Google Maps links. No hooks: safe in Server Components. */
export function AppointmentCard({ appointment: a, timeZone, editHref, headingLevel: H = "h3" }: Props) {
  const start = new Date(a.startsAt);
  const who = a.specialty ? `${a.doctorName} (${a.specialty})` : a.doctorName;
  const calendarUrl = googleCalendarUrl({
    title: `Visit: ${who}`,
    start,
    durationMinutes: a.durationMinutes,
    details: a.reason,
    location: a.location,
  });

  return (
    <Card>
      <H className="text-2xl font-bold">{who}</H>
      <p className="text-xl font-bold">
        {formatLocalDate(start, timeZone)}, {formatLocalTime(start, timeZone)}
      </p>
      {a.location && <p className="text-lg">At {a.location}</p>}
      {a.reason && <p className="text-lg">For {a.reason}</p>}
      {a.notes && <p className="text-muted">{a.notes}</p>}
      {a.questions && a.questions.length > 0 && (
        <>
          <p className="mt-3 text-lg font-bold">Questions to ask</p>
          <ul className="list-disc pl-6 text-lg">
            {a.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <a href={calendarUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
          Add to Google Calendar<span className="sr-only"> (opens in a new tab)</span>
        </a>
        {a.location && (
          <a href={googleMapsUrl(a.location)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
            Directions<span className="sr-only"> to {a.location} (opens in a new tab)</span>
          </a>
        )}
        {editHref && (
          <Link href={editHref} className={buttonClass("secondary")}>
            Edit<span className="sr-only"> visit with {a.doctorName}</span>
          </Link>
        )}
      </div>
    </Card>
  );
}
