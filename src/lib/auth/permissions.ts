/**
 * Who can do what inside a care circle. Every API route calls `assertCan`
 * before touching data. The elder is always in charge.
 */
import type { Circle, CircleRole, Member } from "@/lib/domain/schemas";

export const ACTIONS = [
  "profile.view",
  "profile.edit",
  "members.view",
  "members.manage", // change roles, remove members, rotate passcode
  "medications.view",
  "medications.edit",
  "doses.log",
  "appointments.view",
  "appointments.edit",
  "reports.view",
  "activity.view",
  "ai.use",
  "reminders.run", // "Send reminders now" (demo / manual trigger)
] as const;
export type Action = (typeof ACTIONS)[number];

const ALL = new Set<Action>(ACTIONS);

const MATRIX: Record<CircleRole, ReadonlySet<Action>> = {
  elder: ALL,
  organiser: new Set<Action>([...ACTIONS]), // full rights until the elder claims the profile
  caretaker: new Set<Action>([
    "profile.view",
    "members.view",
    "medications.view",
    "medications.edit",
    "doses.log",
    "appointments.view",
    "appointments.edit",
    "reports.view",
    "activity.view",
    "ai.use",
    "reminders.run",
  ]),
  doctor: new Set<Action>([
    "profile.view",
    "medications.view",
    "medications.edit",
    "appointments.view",
    "appointments.edit",
    "reports.view",
    "ai.use",
  ]),
  family: new Set<Action>([
    "profile.view",
    "members.view",
    "medications.view",
    "doses.log", // "I saw Mum take it"
    "appointments.view",
    "reports.view",
    "activity.view",
  ]),
};

export function can(role: CircleRole, action: Action): boolean {
  return MATRIX[role].has(action);
}

export class ForbiddenError extends Error {
  constructor(action: Action) {
    super(`Not allowed: ${action}`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(role: CircleRole, action: Action): void {
  if (!can(role, action)) throw new ForbiddenError(action);
}

/**
 * Members management rules: once an elder exists in the circle, only the elder
 * may manage members. Nobody can demote or remove the elder.
 */
export function canChangeRole(actor: CircleRole, target: CircleRole, next: CircleRole, circleHasElder: boolean) {
  if (target === "elder" || next === "elder") return false; // elder status only via the claim flow
  if (circleHasElder) return actor === "elder";
  return actor === "organiser";
}

/**
 * Medicines are added/edited only by people the circle owner allowed. Doctors are
 * always allowed. Members saved before the flag existed fall back to their role
 * (elder/organiser yes, others no). The role must also allow `medications.edit`.
 */
export function canEditMedicines(m: Pick<Member, "role" | "medsAuthorized">): boolean {
  if (!can(m.role, "medications.edit")) return false;
  if (m.role === "doctor") return true;
  return m.medsAuthorized ?? (m.role === "elder" || m.role === "organiser");
}

type Owners = Pick<Circle, "createdBy" | "elderUid">;

/** The circle's creator, and the elder once they own it — the people who decide who may add medicines. */
export const isCircleOwner = (circle: Owners, uid: string) => uid === circle.createdBy || uid === circle.elderUid;

/** Can `actorUid` switch `target`'s medicines permission? Owners and doctors are always allowed, so never switchable. */
export function canSetMedsAuthorized(circle: Owners, actorUid: string, target: Pick<Member, "id" | "role">): boolean {
  return (
    isCircleOwner(circle, actorUid) &&
    !isCircleOwner(circle, target.id) &&
    target.role !== "doctor" &&
    can(target.role, "medications.edit")
  );
}
