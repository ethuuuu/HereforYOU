import { setMedsAuthorized } from "@/lib/data/membership";
import { MedsAuthorizedSchema } from "@/lib/domain/schemas";
import { HttpError, isSafeId, json, NotFoundError, readJson, withCircle } from "@/lib/http";

type Ctx = RouteContext<"/api/circles/[id]/members/[uid]/medicines">;

/**
 * Allow or stop a member adding and editing medicines. Any member reaches the
 * data layer, which only lets the circle's creator or the elder change it.
 */
export async function PUT(req: Request, ctx: Ctx) {
  const { id, uid } = await ctx.params;
  return withCircle(req, id, "profile.view", async ({ member }) => {
    if (!isSafeId(uid)) throw new NotFoundError("That member");
    const { medsAuthorized } = await readJson(req, MedsAuthorizedSchema);
    const result = await setMedsAuthorized(id, member, uid, medsAuthorized);
    if (result === "not_found") throw new NotFoundError("That member");
    if (result === "forbidden") {
      throw new HttpError(
        403,
        "Only the person who set up the circle, or the elder, can change who adds medicines. Doctors are always allowed.",
      );
    }
    return json({ ok: true, medsAuthorized });
  });
}
