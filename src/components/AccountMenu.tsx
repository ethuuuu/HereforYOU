"use client";

import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import { Dropdown } from "@/components/ui/Dropdown";

/** Header "Account" menu: who is signed in, Settings and Sign out — one compact button on phones. */
export function AccountMenu({ name }: { name: string }) {
  return (
    <Dropdown label="Account" panelLabel="Account">
      <p className="px-3 pt-1 text-muted">Signed in as</p>
      <p className="px-3 pb-3 text-lg font-bold break-words">{name}</p>
      <div className="flex flex-col gap-2">
        <Link
          href="/settings"
          className="flex min-h-(--tap) items-center rounded-lg px-3 font-bold no-underline hover:bg-warm"
        >
          Settings and passkeys
        </Link>
        <SignOutButton />
      </div>
    </Dropdown>
  );
}
