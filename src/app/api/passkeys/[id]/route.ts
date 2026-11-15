import { requireUser } from "@/lib/auth/session";
import { deletePasskey } from "@/lib/data/passkeys";
import { handle, json, NotFoundError } from "@/lib/http";

/** Removes one of the signed-in person's own passkeys. Someone else's looks "not found". */
export function DELETE(_req: Request, ctx: RouteContext<"/api/passkeys/[id]">) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    if (!/^[A-Za-z0-9_-]{1,1400}$/.test(id) || !(await deletePasskey(user.uid, id))) throw new NotFoundError("That passkey");
    return json({ ok: true });
  });
}
