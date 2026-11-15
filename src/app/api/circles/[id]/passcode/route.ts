import { ForbiddenError } from "@/lib/auth/permissions";
import { getCircle, rotatePasscode } from "@/lib/data/circles";
import { RotatePasscodeSchema } from "@/lib/domain/schemas";
import { json, NotFoundError, readJson, withCircle } from "@/lib/http";

/** New joining passcode. Once the elder owns the circle, only the elder may change it. */
export async function PUT(req: Request, ctx: RouteContext<"/api/circles/[id]/passcode">) {
  const { id } = await ctx.params;
  return withCircle(req, id, "members.manage", async ({ member }) => {
    const { passcode } = await readJson(req, RotatePasscodeSchema);
    const circle = await getCircle(id);
    if (!circle) throw new NotFoundError("Care circle");
    if (circle.elderUid && member.role !== "elder") throw new ForbiddenError("members.manage");
    await rotatePasscode(id, member, passcode);
    return json({ ok: true });
  });
}
