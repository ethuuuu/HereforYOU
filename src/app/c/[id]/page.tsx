import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { requireCircleMember } from "@/lib/auth/page";

export const metadata: Metadata = { title: "Today" };

export default async function CircleHomePage({ params }: PageProps<"/c/[id]">) {
  const { id } = await params;
  const { circle, member } = await requireCircleMember(id);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="today-heading">
        <h2 id="today-heading" className="text-3xl font-bold">
          Today
        </h2>
        <p className="mt-2 text-muted">
          Welcome, {member.name}. Medicine tracking is coming in the next step.
        </p>
      </section>

      <Card>
        <p className="text-xl">
          Your care circle is set up for <strong>{circle.elderName}</strong> in{" "}
          <strong>{circle.timezone.replace(/_/g, " ")}</strong>.
        </p>
        <p className="mt-3 text-muted">
          Your role: <strong className="capitalize">{member.role}</strong>
        </p>
        <p className="mt-3 text-muted">Circle code: <strong className="font-mono">{circle.code}</strong></p>
      </Card>
    </div>
  );
}
