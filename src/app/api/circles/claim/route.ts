import { requireUser } from "@/lib/auth/session";
import { claimCircle, type ClaimResult } from "@/lib/data/circles";
import { ClaimCircleSchema } from "@/lib/domain/schemas";
import { handle, HttpError, json, readJson } from "@/lib/http";

const ERRORS: Record<Exclude<ClaimResult, "ok">, [number, string]> = {
  invalid: [403, "Those codes didn't work. Check both codes, or ask for a new confirmation code."],
  locked: [429, "Too many wrong tries for this circle. Please wait 15 minutes and try again."],
  already_claimed: [409, "This care circle has already been confirmed by its owner."],
  is_organiser: [409, "This code is for the person the circle is for. They enter it on their own phone, signed in as themselves."],
};

/** The elder takes over a circle a relative set up: circle code + one-time confirmation code. */
export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const input = await readJson(req, ClaimCircleSchema);
    const { result, circleId } = await claimCircle(user, input);
    if (result !== "ok") throw new HttpError(...ERRORS[result]);
    return json({ circleId });
  });
}
