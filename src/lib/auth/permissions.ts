/**
 * Who can do what inside a care circle. Every API route calls `assertCan`
 * before touching data. The elder is always in charge.
 */
import type { CircleRole } from "@/lib/domain/schemas";

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
