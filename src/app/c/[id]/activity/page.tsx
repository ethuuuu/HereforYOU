import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { requireCircleMember } from "@/lib/auth/page";
import { assertCan } from "@/lib/auth/permissions";
import { listActivity } from "@/lib/data/activity";

export const metadata: Metadata = { title: "Activity" };

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default async function ActivityPage({ params }: PageProps<"/c/[id]/activity">) {
  const { id } = await params;
  const { member } = await requireCircleMember(id);
  assertCan(member.role, "activity.view");

  const entries = await listActivity(id, 60);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="text-3xl font-bold">
          Activity log
        </h2>
        <p className="mt-2 text-muted">Every change, newest first. All times are in your local zone.</p>
      </section>

      {entries.length === 0 ? (
        <Card>
          <p className="text-muted">No activity yet. Changes to the circle will appear here.</p>
        </Card>
      ) : (
        <ol className="flex flex-col gap-3" aria-label="Activity entries">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-lg border-2 border-line bg-surface px-5 py-4">
              <p className="text-lg">{entry.summary}</p>
              <p className="mt-1 text-sm text-muted">
                <time dateTime={entry.at}>{timeAgo(entry.at)}</time>
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
