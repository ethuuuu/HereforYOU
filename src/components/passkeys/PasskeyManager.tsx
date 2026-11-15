"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toast, type ToastTone } from "@/components/ui/Toast";
import { createPasskey, passkeyErrorMessage } from "./passkeyClient";

export type PasskeyRow = { id: string; deviceName: string; created: string; lastUsed?: string };

/** Settings list: each passkey with a two-step remove, plus "Add a passkey on this device". */
export function PasskeyManager({ passkeys }: { passkeys: PasskeyRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);

  async function add() {
    setBusy("add");
    setToast(null);
    try {
      await createPasskey();
      setToast({ message: "Passkey added. Next time, sign in with your fingerprint or face.", tone: "success" });
      router.refresh();
    } catch (err) {
      setToast({ message: passkeyErrorMessage(err), tone: "error" });
    }
    setBusy(null);
  }

  async function remove(p: PasskeyRow) {
    setBusy(p.id);
    const res = await fetch(`/api/passkeys/${encodeURIComponent(p.id)}`, { method: "DELETE" }).catch(() => null);
    setToast(
      res?.ok
        ? { message: `Passkey on ${p.deviceName} removed.`, tone: "success" }
        : { message: "We couldn't remove that passkey. Please try again.", tone: "error" },
    );
    setConfirming(null);
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {passkeys.length === 0 ? (
        <p className="text-lg">You have no passkeys yet. Add one to sign in with your fingerprint or face.</p>
      ) : (
        <ul className="flex flex-col gap-4" role="list">
          {passkeys.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 rounded-lg border-2 border-line p-4">
              <p className="text-xl font-bold">{p.deviceName}</p>
              <p>
                Added {p.created}. {p.lastUsed ? `Last used ${p.lastUsed}.` : "Not used yet."}
              </p>
              {confirming === p.id ? (
                <div className="flex flex-col gap-3 sm:flex-row" role="group" aria-label={`Remove passkey on ${p.deviceName}?`}>
                  <p className="font-bold">Remove it? You won&apos;t be able to sign in with it any more.</p>
                  <Button variant="danger" onClick={() => remove(p)} loading={busy === p.id} loadingText="Removing…">
                    Yes, remove
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirming(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" onClick={() => setConfirming(p.id)} aria-label={`Remove passkey on ${p.deviceName}`}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Button onClick={add} loading={busy === "add"} loadingText="Follow the steps on your device…">
        <span aria-hidden="true">👆</span>
        Add a passkey on this device
      </Button>
      <Toast message={toast?.message} tone={toast?.tone} />
    </div>
  );
}
