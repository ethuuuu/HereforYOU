"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Toast } from "@/components/ui/Toast";
import { sendJson } from "@/lib/api-client";
import type { Medication } from "@/lib/domain/schemas";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const text = (f: FormData, key: string) => String(f.get(key) ?? "").trim() || undefined;
const num = (f: FormData, key: string) => {
  const v = text(f, key);
  return v === undefined ? undefined : Number(v);
};

/** Add a medicine (no `medication`) or edit one. Shows each field's error next to it. */
export function MedicationForm({ circleId, medication, today }: { circleId: string; medication?: Medication; today: string }) {
  const router = useRouter();
  const [times, setTimes] = useState<string[]>(medication?.times ?? ["08:00"]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const days = new Set(medication?.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6]);
  const base = `/api/circles/${circleId}/medications`;

  async function done(res: Awaited<ReturnType<typeof sendJson>>) {
    if (!res.ok) {
      setErrors(res.fields);
      setFormError(res.error);
      setBusy(false);
      return;
    }
    router.push(`/c/${circleId}/medications`);
    router.refresh();
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErrors({});
    setFormError(null);
    const body = {
      name: text(f, "name"),
      dose: text(f, "dose"),
      purpose: text(f, "purpose"),
      instructions: text(f, "instructions"),
      times: times.filter(Boolean),
      daysOfWeek: f.getAll("daysOfWeek").map(Number),
      startDate: text(f, "startDate"),
      endDate: text(f, "endDate"),
      pillsRemaining: num(f, "pillsRemaining"),
      pillsPerDose: num(f, "pillsPerDose"),
      refillThreshold: num(f, "refillThreshold"),
      prescribedBy: text(f, "prescribedBy"),
    };
    await done(await sendJson(medication ? `${base}/${medication.id}` : base, medication ? "PATCH" : "POST", body));
  }

  async function stop() {
    if (!medication || !window.confirm(`Stop ${medication.name}? It will no longer appear on Today.`)) return;
    setBusy(true);
    await done(await sendJson(`${base}/${medication.id}`, "DELETE"));
  }

  const timeError = Object.entries(errors).find(([k]) => k.startsWith("times"))?.[1];

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Field label="Medicine name" name="name" required defaultValue={medication?.name} error={errors.name} />
      <Field label="Dose" hint="For example: 500 mg, or 1 tablet." name="dose" required defaultValue={medication?.dose} error={errors.dose} />
      <Field label="What it is for (optional)" hint="For example: blood pressure." name="purpose" defaultValue={medication?.purpose} error={errors.purpose} />
      <Field label="How to take it (optional)" hint="For example: after food." name="instructions" defaultValue={medication?.instructions} error={errors.instructions} />

      <fieldset className="flex flex-col gap-3" aria-describedby={timeError ? "times-error" : undefined}>
        <legend className="text-lg font-bold">Times of day</legend>
        {times.map((t, i) => (
          <div key={i} className="flex flex-wrap items-end gap-3">
            <Field
              label={`Time ${i + 1}`}
              type="time"
              value={t}
              onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))}
            />
            {times.length > 1 && (
              <Button variant="secondary" onClick={() => setTimes(times.filter((_, j) => j !== i))}>
                Remove time {i + 1}
              </Button>
            )}
          </div>
        ))}
        {times.length < 8 && (
          <Button variant="secondary" onClick={() => setTimes([...times, ""])}>
            Add another time
          </Button>
        )}
        {timeError && (
          <p id="times-error" className="font-bold text-danger">
            <span aria-hidden="true">! </span>
            {timeError}
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2" aria-describedby={errors.daysOfWeek ? "days-error" : undefined}>
        <legend className="text-lg font-bold">Days</legend>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d, i) => (
            <label key={d} className="inline-flex min-h-(--tap) items-center gap-2 rounded-xl border-2 border-field px-4 text-lg">
              <input type="checkbox" name="daysOfWeek" value={i} defaultChecked={days.has(i)} className="size-6" />
              {d}
            </label>
          ))}
        </div>
        {errors.daysOfWeek && (
          <p id="days-error" className="font-bold text-danger">
            <span aria-hidden="true">! </span>Choose at least one day
          </p>
        )}
      </fieldset>

      <Field label="Start date" type="date" name="startDate" required defaultValue={medication?.startDate ?? today} error={errors.startDate} />
      <Field label="End date (optional)" type="date" name="endDate" defaultValue={medication?.endDate} error={errors.endDate} />
      <Field label="Pills left (optional)" hint="We'll warn you when it's time to refill." type="number" inputMode="numeric" min={0} name="pillsRemaining" defaultValue={medication?.pillsRemaining} error={errors.pillsRemaining} />
      <Field label="Pills per dose" type="number" inputMode="numeric" min={1} name="pillsPerDose" defaultValue={medication?.pillsPerDose ?? 1} error={errors.pillsPerDose} />
      <Field label="Warn me when this many days are left" type="number" inputMode="numeric" min={0} name="refillThreshold" defaultValue={medication?.refillThreshold ?? 7} error={errors.refillThreshold} />
      <Field label="Prescribed by (optional)" name="prescribedBy" defaultValue={medication?.prescribedBy} error={errors.prescribedBy} />

      <Toast message={formError} tone="error" />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" loading={busy} loadingText="Saving…">
          {medication ? "Save changes" : "Add medicine"}
        </Button>
        {medication?.active && (
          <Button variant="danger" disabled={busy} onClick={stop}>
            Stop this medicine
          </Button>
        )}
      </div>
    </form>
  );
}
