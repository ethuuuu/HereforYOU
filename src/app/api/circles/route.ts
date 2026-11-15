import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/session";
import { createCircle } from "@/lib/data/circles";
import { CreateProfileSchema } from "@/lib/domain/schemas";
import { handle, json, readJson } from "@/lib/http";
import { modeCookie } from "@/lib/mode";

/** Create a care circle. The creator becomes the elder, or the organiser until the elder claims it. */
export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const input = await readJson(req, CreateProfileSchema);
    const created = await createCircle(user, input, user.name ?? "A family member");
    if (input.setupRole === "elder") (await cookies()).set(modeCookie(true));
    return json(created, 201);
  });
}
