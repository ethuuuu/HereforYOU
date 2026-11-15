"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await fetch("/api/session", { method: "DELETE" }).catch(() => {});
    router.push("/");
    router.refresh();
    setBusy(false);
  }

  return (
    <Button variant="secondary" onClick={signOut} loading={busy} loadingText="Signing out…">
      Sign out
    </Button>
  );
}
