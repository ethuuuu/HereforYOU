"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Toast } from "@/components/ui/Toast";
import { createPasskey, passkeyErrorMessage, usePasskeySupport } from "./passkeyClient";

/** "Create account with a passkey": name → fingerprint/face → signed in. */
export function PasskeyCreateAccount() {
  const router = useRouter();
  const supported = usePasskeySupport();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!supported) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setNameError("Please enter your name.");
    setNameError(undefined);
    setBusy(true);
    setError(null);
    try {
      router.push((await createPasskey(name.trim())) ?? "/welcome");
      router.refresh();
    } catch (err) {
      setError(passkeyErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="Your name" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} error={nameError} />
      <Button type="submit" loading={busy} loadingText="Creating your account…" className="text-xl">
        <span aria-hidden="true">👆</span>
        Create account with a passkey
      </Button>
      <p className="text-muted">Your fingerprint or face unlocks this phone or computer. No password to remember.</p>
      <Toast message={error} tone="error" />
    </form>
  );
}
