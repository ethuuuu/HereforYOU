import type { Metadata } from "next";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { requireCircleMember } from "@/lib/auth/page";
import { assertCan } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Assistant" };

/** Talk or type to the Gemini assistant. It can look things up and, after you confirm, act. */
export default async function AssistantPage({ params }: PageProps<"/c/[id]/assistant">) {
  const { id } = await params;
  const { member } = await requireCircleMember(id);
  assertCan(member.role, "ai.use");
  return (
    <section aria-labelledby="assistant-heading" className="flex flex-col gap-4">
      <h2 id="assistant-heading" className="text-3xl font-bold">
        Ask the assistant
      </h2>
      <p className="text-lg text-muted">
        Type or press <strong>Speak</strong>. It can tell you about your medicines and visits, and — only after you say yes — mark
        a dose, add a visit or reminder, or email someone in your circle.
      </p>
      <AssistantChat circleId={id} />
    </section>
  );
}
