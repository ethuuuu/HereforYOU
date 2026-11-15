"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { sendJson } from "@/lib/api-client";
import type { DoseState } from "@/lib/domain/adherence";
import type { DoseStatus } from "@/lib/domain/schemas";

export type TodayDose = {
  doseId: string;
  name: string;
  dose: string;
  instructions?: string;
  time: string; // already formatted, e.g. "8:00 am"
  state: DoseState;
};

// Icon + words, never colour alone.
const BADGE: Record<DoseState, { text: string; className: string; stripe: string }> = {
  upcoming: { text: "Upcoming", className: "border-line text-muted", stripe: "border-l-line" },
  due: { text: "⏰ Due now", className: "border-accent text-accent-ink", stripe: "border-l-accent" },
  taken: { text: "✓ Taken", className: "border-success text-success", stripe: "border-l-success" },
  skipped: { text: "– Skipped", className: "border-line text-muted", stripe: "border-l-line" },
  missed: { text: "! Missed", className: "border-danger text-danger", stripe: "border-l-danger" },
};

/** Today's doses as big cards with "I took it" / "Skip". Updates in place, then refreshes the page data. */
export function DoseList({ circleId, doses, canLog }: { circleId: string; doses: TodayDose[]; canLog: boolean }) {
  const router = useRouter();
  const [states, setStates] = useState<Record<string, DoseState>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  async function log(d: TodayDose, status: DoseStatus) {
    setBusy(d.doseId);
    setMessage(null);
    const res = await sendJson(`/api/circles/${circleId}/doses`, "POST", { doseId: d.doseId, status });
    setBusy(null);
    if (!res.ok) return setMessage({ text: res.error, tone: "error" });
    setStates((s) => ({ ...s, [d.doseId]: status }));
    setMessage({ text: `${d.name} at ${d.time}: ${status === "taken" ? "marked as taken" : "skipped"}.`, tone: "success" });
    router.refresh();
  }

  if (doses.length === 0) return <p className="text-muted">No medicines are scheduled for today.</p>;

  return (
    <div className="flex flex-col gap-4">
      <Toast message={message?.text} tone={message?.tone} />
      <ul className="flex flex-col gap-4" role="list">
        {doses.map((d) => {
          const state = states[d.doseId] ?? d.state;
          const badge = BADGE[state];
          const headingId = `dose-${d.doseId}`;
          return (
            <li
              key={d.doseId}
              aria-labelledby={headingId}
              className={`rounded-lg border-2 border-l-8 border-line bg-surface p-5 shadow-sm sm:p-6 ${badge.stripe}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 id={headingId} className="text-2xl font-bold">
                    <span className="block text-3xl text-primary">{d.time}</span>
                    {d.name}
                  </h3>
                  <p className="text-lg">
                    {d.dose}
                    {d.instructions ? ` — ${d.instructions}` : ""}
                  </p>
                </div>
                <p className={`rounded-md border-2 px-3 py-1 font-bold ${badge.className}`}>{badge.text}</p>
              </div>
              {canLog && state !== "taken" && (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <Button
                    aria-describedby={headingId}
                    loading={busy === d.doseId}
                    loadingText="Saving…"
                    disabled={busy !== null}
                    onClick={() => log(d, "taken")}
                  >
                    I took it
                  </Button>
                  {state !== "skipped" && (
                    <Button
                      variant="secondary"
                      aria-describedby={headingId}
                      disabled={busy !== null}
                      onClick={() => log(d, "skipped")}
                    >
                      Skip
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
