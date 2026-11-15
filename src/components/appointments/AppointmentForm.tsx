"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Toast } from "@/components/ui/Toast";
import { sendJson } from "@/lib/api-client";
import type { Appointment } from "@/lib/domain/schemas";

const text = (f: FormData, key: string) => String(f.get(key) ?? "").trim() || undefined;

/** Add a visit (no `appointment`) or edit / delete one. Shows each field's error next to it. */
export function AppointmentForm({ circleId, appointment, today }: { circleId: string; appointment?: Appointment; today: string }) {
  const router = useRouter();
  const notesId = useId();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const base = `/api/circles/${circleId}/appointments`;

  async function done(res: Awaited<ReturnType<typeof sendJson>>) {
    if (!res.ok) {
      setErrors(res.fields);
      setFormError(res.error);
      setBusy(false);
      return;
    }
    router.push(`/c/${circleId}/appointments`);
    router.refresh();
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErrors({});
    setFormError(null);
    const duration = text(f, "durationMinutes");
    const body = {
      doctorName: text(f, "doctorName"),
      specialty: text(f, "specialty"),
      date: text(f, "date"),
      time: text(f, "time"),
      durationMinutes: duration === undefined ? undefined : Number(duration),
      location: text(f, "location"),
      reason: text(f, "reason"),
      notes: text(f, "notes"),
    };
    await done(await sendJson(appointment ? `${base}/${appointment.id}` : base, appointment ? "PATCH" : "POST", body));
  }

  async function remove() {
    if (!appointment || !window.confirm(`Delete the visit with ${appointment.doctorName}?`)) return;
    setBusy(true);
    await done(await sendJson(`${base}/${appointment.id}`, "DELETE"));
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Field label="Doctor's name" name="doctorName" required defaultValue={appointment?.doctorName} error={errors.doctorName} />
      <Field label="Kind of doctor (optional)" hint="For example: heart doctor." name="specialty" defaultValue={appointment?.specialty} error={errors.specialty} />
      <Field label="Date" type="date" name="date" required min={appointment ? undefined : today} defaultValue={appointment?.date ?? today} error={errors.date} />
      <Field label="Time" type="time" name="time" required defaultValue={appointment?.time ?? "10:00"} error={errors.time} />
      <Field label="How long, in minutes" type="number" inputMode="numeric" min={5} max={480} name="durationMinutes" defaultValue={appointment?.durationMinutes ?? 30} error={errors.durationMinutes} />
      <Field label="Where (optional)" hint="Clinic name and address, for directions." name="location" defaultValue={appointment?.location} error={errors.location} />
      <Field label="Reason for the visit (optional)" hint="For example: check-up." name="reason" defaultValue={appointment?.reason} error={errors.reason} />

      <div className="flex flex-col gap-2">
        <label htmlFor={notesId} className="text-lg font-bold">
          Notes (optional)
        </label>
        <textarea
          id={notesId}
          name="notes"
          rows={4}
          defaultValue={appointment?.notes}
          aria-invalid={errors.notes ? true : undefined}
          aria-describedby={errors.notes ? `${notesId}-error` : undefined}
          className={`rounded-xl border-2 bg-bg px-4 py-2 text-lg ${errors.notes ? "border-danger" : "border-field"}`}
        />
        {errors.notes && (
          <p id={`${notesId}-error`} className="font-bold text-danger">
            <span aria-hidden="true">! </span>
            {errors.notes}
          </p>
        )}
      </div>

      <Toast message={formError} tone="error" />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" loading={busy} loadingText="Saving…">
          {appointment ? "Save changes" : "Add appointment"}
        </Button>
        {appointment && (
          <Button variant="danger" disabled={busy} onClick={remove}>
            Delete this appointment
          </Button>
        )}
      </div>
    </form>
  );
}
