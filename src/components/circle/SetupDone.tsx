"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ShareCard } from "./ShareCard";

export type Created = { circleId: string; code: string; claimCode?: string; elderName: string };

/** After creating a circle: elders get the share card; others get the "hand the phone over" claim step. */
export function SetupDone({ created, isElder }: { created: Created; isElder: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const { circleId, code, claimCode, elderName } = created;

  return (
    <div className="flex flex-col gap-6">
      <h2 ref={heading} tabIndex={-1} className="text-3xl font-bold text-primary">
        {isElder ? "Your care circle is ready" : `Hand the phone to ${elderName}`}
      </h2>
      {!isElder && claimCode && (
        <Card className="flex flex-col gap-4">
          <p className="text-xl">
            {elderName} stays in charge of their own care. Ask them to sign in on their own phone, open{" "}
            <strong>{`${window.location.origin}/claim`}</strong> and enter these two codes:
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xl">
            <dt>Circle code</dt>
            <dd className="font-mono font-bold tracking-wider text-primary">{code}</dd>
            <dt>Confirmation code</dt>
            <dd className="font-mono font-bold tracking-wider text-primary">{claimCode}</dd>
          </dl>
          <p className="text-muted">
            The confirmation code works for 7 days and won&rsquo;t be shown again, so write it down now. Until{" "}
            {elderName} confirms, you can manage the circle.
          </p>
        </Card>
      )}
      <ShareCard code={code} elderName={elderName} level={3} />
      <Link href={`/c/${circleId}`} className={buttonClass("primary")}>
        Go to the care circle
      </Link>
    </div>
  );
}
