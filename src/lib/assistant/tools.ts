/**
 * The assistant's tools. Read-only tools run as soon as Gemini asks. Action tools never do:
 * `prepare` validates and describes the action, the person confirms on screen, and only then
 * `execute` runs it (after re-checking the arguments and the person's permission).
 * Gemini never sees emails or uids: people are named by display name or role.
 */
import "server-only";
import { z } from "zod";
import { toGeminiSchema, type ToolDeclaration } from "@/lib/ai/gemini";
import { assertCan, can, type Action } from "@/lib/auth/permissions";
import { googleCalendarUrl } from "@/lib/calendar";
import { logActivity } from "@/lib/data/activity";
import { createAppointment, listAppointmentsBetween } from "@/lib/data/appointments";
import { listDoseLogs, logDose } from "@/lib/data/doseLogs";
import { listActiveMedications } from "@/lib/data/medications";
import { listMembers } from "@/lib/data/members";
import { createTask } from "@/lib/data/tasks";
import { doseState } from "@/lib/domain/adherence";
import { dosesForDate } from "@/lib/domain/schedule";
import {
  AppointmentInputSchema,
  CIRCLE_ROLES,
  DoseStatusSchema,
  TaskInputSchema,
  type Circle,
  type Member,
} from "@/lib/domain/schemas";
import { DAY, formatLocalDate, formatLocalTime, localDateOf, zonedToUtc } from "@/lib/domain/time";
import { findLoggableDose } from "@/lib/doses";
import { sendEmail } from "@/lib/email/mailer";
import { renderPersonalEmail } from "@/lib/email/templates";
import { serverEnv } from "@/lib/env";
import { HttpError } from "@/lib/http";

export type ToolContext = { circle: Circle; member: Member };
export type Pending = { tool: string; args: Record<string, unknown>; summary: string };
export type ActionResult = { reply: string; link?: { href: string; label: string } };

/** A tool argument problem, told back to the model (or to the person on confirm) in plain words. */
export class ToolArgError extends Error {}

type ReadTool<S extends z.ZodType> = {
  kind: "read";
  action: Action;
  description: string;
  schema: S;
  run: (ctx: ToolContext, args: z.infer<S>) => Promise<Record<string, unknown>>;
};
type ActionTool<S extends z.ZodType> = {
  kind: "action";
  action: Action;
  description: string;
  schema: S;
  prepare: (ctx: ToolContext, args: z.infer<S>) => Promise<string>;
  execute: (ctx: ToolContext, args: z.infer<S>) => Promise<ActionResult>;
};
type Tool = ReadTool<z.ZodType> | ActionTool<z.ZodType>;
/** Types each tool's `args` from its own schema, then stores it type-erased (args are always parsed by `schema` first). */
const tool = <S extends z.ZodType>(t: ReadTool<S> | ActionTool<S>) => t as unknown as Tool;

const NoArgs = z.object({});
const tz = (ctx: ToolContext) => ctx.circle.timezone;
const clock = (ctx: ToolContext, date: string, time: string) => formatLocalTime(zonedToUtc(date, time, tz(ctx)), tz(ctx));
const day = (ctx: ToolContext, date: string) => formatLocalDate(zonedToUtc(date, "12:00", tz(ctx)), tz(ctx));

/* ---------- Arguments, and people for send_email (matched by name or role, server-side only) ---------- */

const LogDoseArgs = z.object({
  doseId: z.string().min(1).max(120).describe("doseId from get_today_doses"),
  status: DoseStatusSchema,
});
const VisitArgs = AppointmentInputSchema.pick({
  doctorName: true,
  specialty: true,
  date: true,
  time: true,
  location: true,
  reason: true,
});
const EmailArgs = z.object({
  to: z
    .array(z.string().trim().min(1).max(80))
    .min(1)
    .max(5)
    .describe(`Names of people in the circle, or roles: ${CIRCLE_ROLES.join(", ")}, everyone`),
  subject: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(2000),
});

async function recipients(ctx: ToolContext, to: string[]): Promise<Member[]> {
  const others = (await listMembers(ctx.circle.id)).filter((m) => m.id !== ctx.member.id);
  const found = new Map<string, Member>();
  for (const raw of to) {
    const want = raw.toLowerCase();
    const hits = others.filter((m) => want === "everyone" || m.role === want || m.name.toLowerCase() === want);
    if (hits.length === 0) {
      const names = others.map((m) => `${m.name} (${m.role})`).join(", ") || "nobody else yet";
      throw new ToolArgError(`No one called "${raw}" is in the circle. People: ${names}.`);
    }
    hits.forEach((m) => found.set(m.id, m));
  }
  const list = [...found.values()].filter((m) => m.email);
  if (list.length === 0) throw new ToolArgError("None of those people has an email address saved.");
  return list;
}

/* ---------- The tools ---------- */

const TOOLS: Record<string, Tool> = {
  get_today_doses: tool({
    kind: "read",
    action: "medications.view",
    description: "Today's medicine doses with their time and state (taken, skipped, missed, due, upcoming) and doseId.",
    schema: NoArgs,
    async run(ctx) {
      const today = localDateOf(new Date(), tz(ctx));
      const [meds, logs] = await Promise.all([listActiveMedications(ctx.circle.id), listDoseLogs(ctx.circle.id, today, today)]);
      const byId = new Map(logs.map((l) => [l.doseId, l]));
      const now = new Date();
      return {
        doses: dosesForDate(meds, today, tz(ctx)).map((d) => ({
          doseId: d.doseId,
          medicine: `${d.medicationName} ${d.dose}`,
          time: formatLocalTime(d.scheduledAt, tz(ctx)),
          state: doseState(d, byId.get(d.doseId), now),
        })),
      };
    },
  }),
  get_medicines: tool({
    kind: "read",
    action: "medications.view",
    description: "The medicines currently being taken, with dose, times and instructions.",
    schema: NoArgs,
    async run(ctx) {
      const meds = await listActiveMedications(ctx.circle.id);
      return { medicines: meds.map(({ name, dose, times, instructions, purpose }) => ({ name, dose, times, instructions, purpose })) };
    },
  }),
  get_upcoming_visits: tool({
    kind: "read",
    action: "appointments.view",
    description: "Doctor visits in the next 60 days, soonest first.",
    schema: NoArgs,
    async run(ctx) {
      const now = new Date();
      const visits = await listAppointmentsBetween(ctx.circle.id, now.toISOString(), new Date(now.getTime() + 60 * DAY).toISOString());
      return {
        visits: visits.slice(0, 5).map((a) => ({
          doctor: a.doctorName,
          specialty: a.specialty,
          when: `${day(ctx, a.date)} at ${clock(ctx, a.date, a.time)}`,
          location: a.location,
          reason: a.reason,
        })),
      };
    },
  }),
  get_people: tool({
    kind: "read",
    action: "members.view",
    description: "The other people in the care circle (name and role), e.g. to choose who to email.",
    schema: NoArgs,
    async run(ctx) {
      const others = (await listMembers(ctx.circle.id)).filter((m) => m.id !== ctx.member.id);
      return { people: others.map((m) => ({ name: m.name, role: m.role, hasEmail: Boolean(m.email) })) };
    },
  }),
  log_dose: tool({
    kind: "action",
    action: "doses.log",
    description: "Propose marking one of today's (or yesterday's) doses as taken or skipped. Call get_today_doses first for the doseId.",
    schema: LogDoseArgs,
    async prepare(ctx, { doseId, status }) {
      const d = await loggableDose(ctx, doseId);
      return `Mark ${d.medicationName} ${d.dose} (${formatLocalTime(d.scheduledAt, tz(ctx))}) as ${status}?`;
    },
    async execute(ctx, { doseId, status }) {
      const d = await loggableDose(ctx, doseId);
      await logDose(ctx.circle.id, ctx.member, d, status);
      return { reply: `Done. ${d.medicationName} is marked as ${status}.` };
    },
  }),
  schedule_visit: tool({
    kind: "action",
    action: "appointments.edit",
    description: "Propose adding a doctor's visit (appointment).",
    schema: VisitArgs,
    async prepare(ctx, v) {
      return `Add a visit with ${v.doctorName}${v.specialty ? ` (${v.specialty})` : ""} on ${day(ctx, v.date)} at ${clock(ctx, v.date, v.time)}${v.location ? ` at ${v.location}` : ""}?`;
    },
    async execute(ctx, v) {
      const input = AppointmentInputSchema.parse(v);
      const start = zonedToUtc(input.date, input.time, tz(ctx));
      await createAppointment(ctx.circle.id, ctx.member, input, start.toISOString());
      const href = googleCalendarUrl({
        title: `Visit: ${input.doctorName}`,
        start,
        durationMinutes: input.durationMinutes,
        details: input.reason,
        location: input.location,
      });
      return { reply: `Done. The visit with ${input.doctorName} is saved.`, link: { href, label: "Add to Google Calendar" } };
    },
  }),
  create_task: tool({
    kind: "action",
    action: "appointments.edit",
    description: "Propose adding a to-do or reminder (e.g. 'call the pharmacy') for a day, shown on the Today page.",
    schema: TaskInputSchema,
    async prepare(ctx, t) {
      return `Add a reminder "${t.title}" on ${day(ctx, t.date)}${t.time ? ` at ${clock(ctx, t.date, t.time)}` : ""}?`;
    },
    async execute(ctx, t) {
      await createTask(ctx.circle.id, ctx.member, t);
      return { reply: `Done. "${t.title}" will show on the Today page on ${day(ctx, t.date)}.` };
    },
  }),
  send_email: tool({
    kind: "action",
    action: "members.view",
    description: "Propose sending an email from this person to others in the care circle.",
    schema: EmailArgs,
    async prepare(ctx, e) {
      const to = await recipients(ctx, e.to);
      return `Send this email to ${to.map((m) => m.name).join(", ")}?\nSubject: ${e.subject}\n\n${e.message}`;
    },
    async execute(ctx, e) {
      const to = await recipients(ctx, e.to);
      const content = renderPersonalEmail(
        { from: ctx.member.name, subject: e.subject, message: e.message },
        { elderName: ctx.circle.elderName, timezone: tz(ctx), appUrl: serverEnv().APP_URL },
      );
      // One email per person; one failure doesn't stop the rest.
      const results = await Promise.allSettled(to.map((m) => sendEmail(m.email!, content)));
      const sent = to.filter((_, i) => results[i].status === "fulfilled").map((m) => m.name);
      if (sent.length === 0) throw new HttpError(502, "The email couldn't be sent just now. Please try again.");
      await logActivity(ctx.circle.id, {
        actorUid: ctx.member.id,
        actorName: ctx.member.name,
        action: "assistant.email",
        summary: `${ctx.member.name} emailed ${sent.join(", ")}: "${e.subject}"`,
      });
      const missed = to.length - sent.length;
      return { reply: `Sent to ${sent.join(", ")}.${missed ? ` ${missed} could not be reached.` : ""}` };
    },
  }),
};

async function loggableDose(ctx: ToolContext, doseId: string) {
  try {
    return await findLoggableDose(ctx.circle.id, tz(ctx), doseId);
  } catch (err) {
    if (err instanceof HttpError) throw new ToolArgError(err.message);
    throw err;
  }
}

/* ---------- Entry points used by the route ---------- */

/** Declarations Gemini may call: only tools this role is allowed to use. */
export function toolDeclarations(member: Member): ToolDeclaration[] {
  return Object.entries(TOOLS)
    .filter(([, t]) => can(member.role, t.action))
    .map(([name, t]) => ({ name, description: t.description, parametersJsonSchema: toGeminiSchema(t.schema) }));
}

/**
 * A tool call from Gemini. Read tools run and return data; action tools return a pending action
 * (nothing is changed). Problems come back as `{ error }` so the model can explain or ask.
 */
export async function handleModelCall(
  ctx: ToolContext,
  name: string,
  rawArgs: Record<string, unknown>,
): Promise<{ output: Record<string, unknown> } | { pending: Pending }> {
  const tool = TOOLS[name];
  if (!tool || !can(ctx.member.role, tool.action)) return { output: { error: "That tool isn't available." } };
  const parsed = tool.schema.safeParse(rawArgs);
  if (!parsed.success) return { output: { error: `Invalid arguments: ${z.prettifyError(parsed.error)}` } };
  try {
    if (tool.kind === "read") return { output: await tool.run(ctx, parsed.data) };
    const summary = await tool.prepare(ctx, parsed.data);
    return { pending: { tool: name, args: parsed.data as Record<string, unknown>, summary } };
  } catch (err) {
    if (err instanceof ToolArgError) return { output: { error: err.message } };
    throw err;
  }
}

/** The person said "Yes, do it": re-check permission and arguments, then run the action. */
export async function executeAction(ctx: ToolContext, name: string, rawArgs: Record<string, unknown>): Promise<ActionResult> {
  const tool = TOOLS[name];
  if (!tool || tool.kind !== "action") throw new HttpError(400, "That action isn't available.");
  assertCan(ctx.member.role, tool.action); // 403
  const args = tool.schema.parse(rawArgs); // ZodError → 400
  try {
    return await tool.execute(ctx, args);
  } catch (err) {
    if (err instanceof ToolArgError) throw new HttpError(400, err.message);
    throw err;
  }
}
