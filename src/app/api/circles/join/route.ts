import { requireUser } from "@/lib/auth/session";
import { joinCircle } from "@/lib/data/membership";
import { JoinCircleSchema } from "@/lib/domain/schemas";
import { handle, HttpError, json, readJson } from "@/lib/http";

/** Join with circle code + passcode. Wrong code and wrong passcode get the same message. */
export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const input = await readJson(req, JoinCircleSchema);
    const { result, circleId } = await joinCircle(user, input);
    if (result === "locked") {
      throw new HttpError(429, "Too many wrong tries for this circle. Please wait 15 minutes and try again.");
    }
    if (result !== "ok") {
      throw new HttpError(403, "That circle code and passcode don't match. Please check them and try again.");
    }
    return json({ circleId });
  });
}
