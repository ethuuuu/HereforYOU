"use client";

import { signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { clientAuth, googleProvider } from "@/lib/firebase/client";

const CANCELLED = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

/** "Continue with Google": Firebase popup → ID token → server session cookie. */
export function GoogleSignIn() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const { user } = await signInWithPopup(clientAuth(), googleProvider);
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken: await user.getIdToken() }),
      });
      if (!res.ok) throw new Error("session");
      const { next } = (await res.json()) as { next: string };
      router.push(next);
      router.refresh();
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      setError(
        CANCELLED.has(code)
          ? "Sign-in was cancelled. Press the button to try again."
          : code === "auth/popup-blocked"
            ? "Your browser blocked the Google window. Please allow pop-ups for this site and try again."
            : "We couldn't sign you in. Please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={signIn} loading={busy} loadingText="Signing you in…" className="text-xl">
        <span aria-hidden="true" className="rounded-full bg-on-primary px-2 font-bold text-primary">
          G
        </span>
        Continue with Google
      </Button>
      <Toast message={error} tone="error" />
    </div>
  );
}
