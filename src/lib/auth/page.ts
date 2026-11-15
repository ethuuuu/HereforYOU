import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { getCircle } from "@/lib/data/circles";
import { getMember } from "@/lib/data/members";
import { isSafeId } from "@/lib/http";

/** Page guard: signed in (else → /signin) and a member of the circle (else 404). Cached per request. */
export const requireCircleMember = cache(async (circleId: string) => {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if (!isSafeId(circleId)) notFound();
  const [member, circle] = await Promise.all([getMember(circleId, user.uid), getCircle(circleId)]);
  if (!member || !circle?.active) notFound();
  return { user, member, circle };
});

/** Page guard for setup screens: signed in, else → /signin. */
export async function requirePageUser() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  return user;
}
