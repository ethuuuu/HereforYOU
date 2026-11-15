/**
 * Route handler helpers. Every circle route goes through `withCircle`:
 * signed in → member of the circle → allowed to do `action` → handler.
 * Errors become safe JSON responses; internal details are only logged.
 */
import "server-only";
import { ZodError, type ZodType } from "zod";
import { assertCan, canEditMedicines, ForbiddenError, type Action } from "@/lib/auth/permissions";
import { requireUser, UnauthorizedError, type SessionUser } from "@/lib/auth/session";
import { getMember } from "@/lib/data/members";
import type { Member } from "@/lib/domain/schemas";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class NotFoundError extends HttpError {
  constructor(what = "That") {
    super(404, `${what} was not found.`);
    this.name = "NotFoundError";
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

/** Maps any thrown error to a response. Never leaks stack traces or internal messages. */
export function errorResponse(err: unknown): Response {
  if (err instanceof UnauthorizedError) return json({ error: "Please sign in to continue." }, 401);
  if (err instanceof ForbiddenError) return json({ error: "You don't have permission to do that." }, 403);
  if (err instanceof ZodError) {
    const fields = Object.fromEntries(err.issues.map((i) => [i.path.join(".") || "_", i.message]));
    return json({ error: "Please check the highlighted fields.", fields }, 400);
  }
  if (err instanceof HttpError) return json({ error: err.message }, err.status);
  console.error("[api] unexpected error", err);
  return json({ error: "Something went wrong. Please try again." }, 500);
}

/** Runs a handler and turns thrown errors into responses. Use for routes outside a circle. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    return errorResponse(err);
  }
}

/** Parses a JSON body with a zod schema. Non-JSON → 415, bad JSON → 400, invalid → ZodError (400). */
export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Please send the request as JSON.");
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "That request could not be read.");
  }
  return schema.parse(body);
}

export type CircleContext = { user: SessionUser; member: Member; circleId: string };

// Firestore auto-ids and Firebase uids are URL-safe; anything else can't be real (and
// could escape the document path), so it's treated as "not found".
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
export const isSafeId = (id: string) => SAFE_ID.test(id);
export const MEDS_NOT_ALLOWED = "Only people the circle owner has allowed can add or change medicines.";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function withCircle(
  req: Request,
  circleId: string,
  action: Action,
  handler: (ctx: CircleContext) => Promise<Response>,
): Promise<Response> {
  return handle(async () => {
    // Mutations accept JSON only: blocks cross-site HTML form posts (CSRF).
    const type = req.headers.get("content-type");
    if (!SAFE_METHODS.has(req.method) && type && !type.toLowerCase().startsWith("application/json")) {
      throw new HttpError(415, "Please send the request as JSON.");
    }
    const user = await requireUser();
    // Not a member and no such circle look the same, so circle ids can't be probed.
    if (!isSafeId(circleId)) throw new NotFoundError("Care circle");
    const member = await getMember(circleId, user.uid);
    if (!member) throw new NotFoundError("Care circle");
    assertCan(member.role, action);
    if (action === "medications.edit" && !canEditMedicines(member)) throw new HttpError(403, MEDS_NOT_ALLOWED);
    return handler({ user, member, circleId });
  });
}
