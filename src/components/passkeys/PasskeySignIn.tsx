"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { passkeyErrorMessage, signInWithPasskey, usePasskeySupport } from "./passkeyClient";

/** Big "Sign in with fingerprint or face" button. Hidden where the browser can't do passkeys. */
export function PasskeySignIn() {
  const router = useRouter();
  const supported = usePasskeySupport();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!supported) return null;

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      router.push(await signInWithPasskey());
      router.refresh();
    } catch (err) {
      setError(passkeyErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={signIn} loading={busy} loadingText="Signing you in…" className="text-xl">
        <span aria-hidden="true">👆</span>
        Sign in with fingerprint or face
      </Button>
      <Toast message={error} tone="error" />
    </div>
  );
}
