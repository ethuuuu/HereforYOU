"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, SelectField } from "@/components/ui/Field";
import { Toast } from "@/components/ui/Toast";
import { sendJson } from "@/lib/api-client";
import type { SetupRole } from "@/lib/domain/schemas";
import { applyModeInBrowser } from "@/lib/mode";
import { applyPrefsInBrowser, readPrefsInBrowser } from "@/lib/prefs";
import { SetupDone, type Created } from "./SetupDone";

const COMMON_ZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
  "Africa/Johannesburg",
];
const subscribe = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Create a care circle. The elder version is short; others also give the elder's email. */
export function CreateCircleForm({ setupRole, nameLabel }: { setupRole: SetupRole; nameLabel: string }) {
  const isElder = setupRole === "elder";
  const detected = useSyncExternalStore(subscribe, browserZone, () => "Asia/Kolkata");
  const [zone, setZone] = useState<string | null>(null);
  const timezone = zone ?? detected;
  const zones = [...new Set([timezone, ...COMMON_ZONES])];

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Created | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const passcode = String(f.get("passcode") ?? "");
    if (passcode !== f.get("confirm")) {
      setErrors({ confirm: "The two passcodes are different. Type the same numbers in both boxes." });
      setFormError("Please check the highlighted fields.");
      return;
    }
    const elderName = String(f.get("elderName") ?? "");
    const largeText = isElder && f.get("largeText") === "on";
    setBusy(true);
    setErrors({});
    setFormError(null);
    const res = await sendJson<Omit<Created, "elderName">>("/api/circles", "POST", {
      setupRole,
      elderName,
      ...(f.get("elderEmail") ? { elderEmail: f.get("elderEmail") } : {}),
      timezone,
      passcode,
      largeText,
    });
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fields);
      setFormError(res.error);
      return;
    }
    if (largeText) applyPrefsInBrowser({ ...readPrefsInBrowser(), largeText: true });
    if (isElder) applyModeInBrowser(true); // the server set the cookie; show the elder layout now
    setDone({ ...res.data, elderName });
  }

  if (done) return <SetupDone created={done} isElder={isElder} />;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Field label={nameLabel} name="elderName" autoComplete={isElder ? "name" : "off"} required error={errors.elderName} />
      {!isElder && (
        <Field
          label="Their email (optional)"
          hint="Medicine reminders go here. You can add it later."
          name="elderEmail"
          type="email"
          autoComplete="off"
          error={errors.elderEmail}
        />
      )}
      <SelectField
        label="Time zone"
        hint="Reminders follow this clock."
        name="timezone"
        value={timezone}
        onChange={(e) => setZone(e.target.value)}
        error={errors.timezone}
      >
        {zones.map((z) => (
          <option key={z} value={z}>
            {z.replace(/_/g, " ")}
          </option>
        ))}
      </SelectField>
      <Field
        label="Create a passcode"
        hint="6 to 12 numbers. People need it to join, so share it only with people you trust."
        name="passcode"
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        required
        error={errors.passcode}
      />
      <Field
        label="Type the passcode again"
        name="confirm"
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        required
        error={errors.confirm}
      />
      {isElder && (
        <label className="flex min-h-(--tap) items-center gap-3 text-lg">
          <input type="checkbox" name="largeText" defaultChecked className="size-6" />
          Use larger text (recommended)
        </label>
      )}
      <Toast message={formError} tone="error" />
      <Button type="submit" loading={busy} loadingText="Creating…">
        Create the care circle
      </Button>
    </form>
  );
}
