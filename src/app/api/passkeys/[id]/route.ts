import { requireUser } from "@/lib/auth/session";
import { deletePasskey, listPasskeys } from "@/lib/data/passkeys";
import { adminAuth } from "@/lib/firebase/admin";
import { handle, HttpError, json, NotFoundError } from "@/lib/http";

/** Removes one of the signed-in person's own passkeys. Someone else's looks "not found". */
export function DELETE(_req: Request, ctx: RouteContext<"/api/passkeys/[id]">) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    if (!/^[A-Za-z0-9_-]{1,1400}$/.test(id)) throw new NotFoundError("That passkey");
    // Never let someone lock themselves out: keep the last passkey unless they can also sign in with Google.
    if ((await listPasskeys(user.uid)).length <= 1) {
      const { providerData } = await adminAuth().getUser(user.uid);
      if (!providerData.some((p) => p.providerId === "google.com")) {
        throw new HttpError(409, "This is your only way to sign in, so it can't be removed. Add another passkey first.");
      }
    }
    if (!(await deletePasskey(user.uid, id))) throw new NotFoundError("That passkey");
    return json({ ok: true });
  });
}
