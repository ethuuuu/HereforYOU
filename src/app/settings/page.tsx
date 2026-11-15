import type { Metadata } from "next";
import { PasskeyManager } from "@/components/passkeys/PasskeyManager";
import { Card } from "@/components/ui/Card";
import { requirePageUser } from "@/lib/auth/page";
import { listPasskeys } from "@/lib/data/passkeys";

export const metadata: Metadata = { title: "Settings" };

const day = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

export default async function SettingsPage() {
  const user = await requirePageUser();
  const passkeys = await listPasskeys(user.uid);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-4xl font-bold text-primary">Settings</h1>
      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold">Sign in with your fingerprint or face</h2>
        <p>A passkey is saved on your phone or computer. It lets you sign in to this same account without Google or a password.</p>
        <PasskeyManager
          passkeys={passkeys.map((p) => ({
            id: p.id,
            deviceName: p.deviceName,
            created: day(p.createdAt),
            ...(p.lastUsedAt ? { lastUsed: day(p.lastUsedAt) } : {}),
          }))}
        />
      </Card>
    </div>
  );
}
