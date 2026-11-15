import { ForbiddenError } from "@/lib/auth/permissions";
import { changeRole, removeMember, type ManageResult } from "@/lib/data/membership";
import { ChangeRoleSchema } from "@/lib/domain/schemas";
import { isSafeId, json, NotFoundError, readJson, withCircle } from "@/lib/http";

type Ctx = RouteContext<"/api/circles/[id]/members/[uid]">;

function respond(result: ManageResult): Response {
  if (result === "not_found") throw new NotFoundError("That member");
  if (result === "forbidden") throw new ForbiddenError("members.manage");
  return json({ ok: true });
}

/** Change a member's role (elder, or organiser before the elder claims the circle). */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id, uid } = await ctx.params;
  return withCircle(req, id, "members.manage", async ({ member }) => {
    if (!isSafeId(uid)) throw new NotFoundError("That member");
    const { role } = await readJson(req, ChangeRoleSchema);
    return respond(await changeRole(id, member, uid, role));
  });
}

/** Remove a member. Nobody can remove the elder. */
export async function DELETE(req: Request, ctx: Ctx) {
  const { id, uid } = await ctx.params;
  return withCircle(req, id, "members.manage", async ({ member }) => {
    if (!isSafeId(uid)) throw new NotFoundError("That member");
    return respond(await removeMember(id, member, uid));
  });
}
