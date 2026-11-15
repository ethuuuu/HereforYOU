"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toast, type ToastTone } from "@/components/ui/Toast";
import { sendJson } from "@/lib/api-client";
import type { NotifyPrefs } from "@/lib/domain/schemas";

type Message = { message: string; tone: ToastTone } | null;

/** Runs this circle's reminders right away and announces how many emails went out. */
export function SendRemindersNow({ circleId }: { circleId: string }) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Message>(null);

  async function run() {
    setBusy(true);
    setToast(null);
    const res = await sendJson<{ sent: number; failed: number }>(`/api/circles/${circleId}/reminders/run-now`, "POST");
    setBusy(false);
    if (!res.ok) return setToast({ message: res.error, tone: "error" });
    const { sent, failed } = res.data;
    if (failed > 0) return setToast({ message: `Sent ${sent} email(s). ${failed} could not be sent.`, tone: "error" });
    setToast({
      message: sent === 0 ? "Nothing is due right now — no emails sent." : `Sent ${sent} reminder email(s).`,
      tone: "success",
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={run} loading={busy} loadingText="Sending…">
        Send reminders now
      </Button>
      <Toast message={toast?.message} tone={toast?.tone ?? "info"} />
    </div>
  );
}

const PREF_LABELS: Record<keyof NotifyPrefs, string> = {
  doseUpcoming: "A dose is coming up (15 minutes before)",
  doseMissed: "A dose was missed (30 minutes after)",
  escalation: "A dose is still not taken after an hour",
  appointments: "Doctor visits (the day before and 2 hours before)",
  refills: "Medicine is running low",
};

/** The signed-in member's own reminder email choices. */
export function NotifyPrefsForm({ circleId, initial }: { circleId: string; initial: NotifyPrefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Message>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setToast(null);
    const res = await sendJson(`/api/circles/${circleId}/notify`, "PUT", prefs);
    setBusy(false);
    setToast(res.ok ? { message: "Your email choices are saved.", tone: "success" } : { message: res.error, tone: "error" });
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-lg font-bold">Email me when…</legend>
        {(Object.keys(PREF_LABELS) as (keyof NotifyPrefs)[]).map((k) => (
          <label key={k} className="inline-flex min-h-(--tap) items-center gap-3 rounded-lg border-2 border-field px-4 text-lg">
            <input
              type="checkbox"
              checked={prefs[k]}
              onChange={(e) => setPrefs({ ...prefs, [k]: e.target.checked })}
              className="size-6"
            />
            {PREF_LABELS[k]}
          </label>
        ))}
      </fieldset>
      <Toast message={toast?.message} tone={toast?.tone ?? "info"} />
      <Button type="submit" variant="secondary" loading={busy} loadingText="Saving…">
        Save email choices
      </Button>
    </form>
  );
}
