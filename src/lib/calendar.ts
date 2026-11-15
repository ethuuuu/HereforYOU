/**
 * "Add to Google Calendar" links — no OAuth needed. Pure (unit-tested).
 */
function toGoogleDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function googleCalendarUrl(event: {
  title: string;
  start: Date;
  durationMinutes: number;
  details?: string;
  location?: string;
}): string {
  const end = new Date(event.start.getTime() + event.durationMinutes * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toGoogleDate(event.start)}/${toGoogleDate(end)}`,
  });
  if (event.details) params.set("details", event.details);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Google Maps search link for a clinic address. */
export function googleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}
