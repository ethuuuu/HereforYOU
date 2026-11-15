import { getMember } from "@/lib/data/members";
import type { Circle } from "@/lib/domain/schemas";

/** Who to ask for permission: the elder once they own the circle, else its creator. 1 read at most. */
export async function medsOwnerName(circle: Circle): Promise<string> {
  if (circle.elderUid) return circle.elderName;
  return (await getMember(circle.id, circle.createdBy))?.name ?? "the person who set up this circle";
}

/** Shown instead of a medicine form to people the circle owner hasn't allowed. */
export async function MedsNotAllowed({ circle }: { circle: Circle }) {
  return (
    <p className="text-lg text-muted">
      Only people the circle owner has allowed can add medicines. Ask {await medsOwnerName(circle)} to allow you.
    </p>
  );
}
