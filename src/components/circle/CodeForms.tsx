"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Toast } from "@/components/ui/Toast";
import { sendJson } from "@/lib/api-client";
import type { SetupRole } from "@/lib/domain/schemas";
import { applyPrefsInBrowser, readPrefsInBrowser } from "@/lib/prefs";

/** Shared submit flow: POST the form, show field errors, go to the circle on success. */
function useCodeForm(url: string, toBody: (f: FormData) => unknown, onSuccess?: () => void) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    const res = await sendJson<{ circleId: string }>(url, "POST", toBody(new FormData(e.currentTarget)));
    if (!res.ok) {
      setErrors(res.fields);
      setFormError(res.error);
      setBusy(false);
      return;
    }
    onSuccess?.();
    router.push(`/c/${res.data.circleId}`);
    router.refresh();
  }
  return { errors, formError, busy, submit };
}

function CodeForm({ submit, formError, busy, label, children }: ReturnType<typeof useCodeForm> & { label: string; children: ReactNode }) {
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {children}
      <Toast message={formError} tone="error" />
      <Button type="submit" loading={busy} loadingText="Checking…">
        {label}
      </Button>
    </form>
  );
}

const codeField = (error?: string) => (
  <Field
    label="Circle code"
    hint="It looks like HFY-7K3P9Q."
    name="circleCode"
    autoCapitalize="characters"
    autoComplete="off"
    spellCheck={false}
    required
    error={error}
  />
);

/** Join an existing circle with its code + passcode. New members start as family. */
export function JoinCircleForm({ setupRole, defaultName }: { setupRole: Exclude<SetupRole, "elder">; defaultName?: string }) {
  const form = useCodeForm("/api/circles/join", (f) => ({
    circleCode: f.get("circleCode"),
    passcode: f.get("passcode"),
    displayName: f.get("displayName"),
    setupRole,
  }));
  return (
    <CodeForm {...form} label="Join the care circle">
      {codeField(form.errors.circleCode)}
      <Field
        label="Passcode"
        hint="6 to 12 numbers. Ask the person who set up the circle."
        name="passcode"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        required
        error={form.errors.passcode}
      />
      <Field
        label="Your name"
        hint="This is how others in the circle will see you."
        name="displayName"
        autoComplete="name"
        defaultValue={defaultName}
        required
        error={form.errors.displayName}
      />
    </CodeForm>
  );
}

/** The elder confirms a circle a relative set up for them. */
export function ClaimForm() {
  const form = useCodeForm(
    "/api/circles/claim",
    (f) => ({ circleCode: f.get("circleCode"), claimCode: f.get("claimCode") }),
    () => applyPrefsInBrowser({ ...readPrefsInBrowser(), largeText: true }),
  );
  return (
    <CodeForm {...form} label="Confirm my care circle">
      {codeField(form.errors.circleCode)}
      <Field
        label="Confirmation code"
        hint="6 numbers, from the person who set this up."
        name="claimCode"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        error={form.errors.claimCode}
      />
    </CodeForm>
  );
}
