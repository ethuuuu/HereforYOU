import { updateNotifyPrefs } from "@/lib/data/members";
import { NotifyPrefsSchema } from "@/lib/domain/schemas";
import { json, readJson, withCircle } from "@/lib/http";

/** The signed-in member chooses which reminder emails they get. Every member may change their own. */
export async function PUT(req: Request, ctx: RouteContext<"/api/circles/[id]/notify">) {
  const { id } = await ctx.params;
  // "profile.view" = any member; the write only ever touches the caller's own member doc.
  return withCircle(req, id, "profile.view", async ({ member }) => {
    const notify = await readJson(req, NotifyPrefsSchema.strict());
    await updateNotifyPrefs(id, member, notify);
    return json({ ok: true, notify });
  });
}
