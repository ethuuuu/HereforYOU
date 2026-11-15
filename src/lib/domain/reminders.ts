/**
 * Reminder planner — decides WHICH emails should go out RIGHT NOW.
 *
 * Pure function: give it the current time and the circle's data, get back a list
 * of reminder actions. The runner (/api/reminders/run) sends them and records each
 * `key` so the same reminder is never sent twice. Safe to call every few minutes.
 *
 * Escalation ladder for a dose that hasn't been logged:
 *   T-15 min  → "upcoming" to the elder (and anyone opted in)
 *   T+30 min  → "missed" to the elder
 *   T+60 min  → "escalation" to caretakers / organiser / family who opted in
 */
import { daysOfSupplyLeft, type DoseInstance } from "./schedule";
import type { Appointment, DoseLog, Medication, Member, NotifyPrefs } from "./schemas";
import { HOUR, MINUTE } from "./time";

export const UPCOMING_LEAD_MINUTES = 15;
export const MISSED_AFTER_MINUTES = 30;
export const ESCALATE_AFTER_MINUTES = 60;
/** Don't nag about doses older than this (e.g. after downtime). */
export const LOOKBACK_HOURS = 6;
/** Appointment reminders: one the day before, one shortly before. */
export const APPOINTMENT_DAY_BEFORE_HOURS = 24;
export const APPOINTMENT_SOON_HOURS = 2;

export type ReminderKind =
  | "dose_upcoming"
  | "dose_missed"
  | "dose_escalation"
  | "appointment_day_before"
  | "appointment_soon"
  | "refill_low";

export type Recipient = { memberId: string; name: string; email: string; role: Member["role"] };

export type ReminderAction = {
  /** Idempotency key — record it after sending; never send the same key twice. */
  key: string;
  kind: ReminderKind;
  recipients: Recipient[];
  dose?: DoseInstance;
  appointment?: Appointment;
  medication?: Pick<Medication, "id" | "name" | "pillsRemaining">;
  daysLeft?: number;
};

export type PlanInput = {
  now: Date;
  localToday: string; // YYYY-MM-DD in the elder's zone (used for daily keys)
  doses: DoseInstance[]; // doses for yesterday + today (+ tomorrow) in the elder's zone
  logs: DoseLog[];
  appointments: Appointment[];
  medications: Medication[];
  members: Member[];
  alreadySent: ReadonlySet<string>;
};

const ELDER_SIDE: Member["role"][] = ["elder"];
const SUPPORT_SIDE: Member["role"][] = ["organiser", "caretaker", "family"];

function recipientsFor(members: Member[], roles: Member["role"][], pref: keyof NotifyPrefs): Recipient[] {
  return members
    .filter((m) => roles.includes(m.role) && m.notify[pref] && !!m.email)
    .map((m) => ({ memberId: m.id, name: m.name, email: m.email as string, role: m.role }));
}

export function planReminders(input: PlanInput): ReminderAction[] {
  const { now, logs, alreadySent, members } = input;
  const t = now.getTime();
  const logged = new Set(logs.map((l) => l.doseId));
  const actions: ReminderAction[] = [];

  const push = (action: ReminderAction) => {
    if (action.recipients.length === 0 || alreadySent.has(action.key)) return;
    actions.push(action);
  };

  /* ---- Doses ---- */
  for (const dose of input.doses) {
    if (logged.has(dose.doseId)) continue;
    const at = dose.scheduledAt.getTime();
    if (t < at - UPCOMING_LEAD_MINUTES * MINUTE) continue; // too early for anything
    if (t > at + LOOKBACK_HOURS * HOUR) continue; // too old to act on

    if (t < at) {
      push({
        key: `dose_upcoming:${dose.doseId}`,
        kind: "dose_upcoming",
        recipients: recipientsFor(members, ELDER_SIDE, "doseUpcoming"),
        dose,
      });
      continue;
    }
    if (t >= at + ESCALATE_AFTER_MINUTES * MINUTE) {
      push({
        key: `dose_escalation:${dose.doseId}`,
        kind: "dose_escalation",
        recipients: recipientsFor(members, SUPPORT_SIDE, "escalation"),
        dose,
      });
    }
    if (t >= at + MISSED_AFTER_MINUTES * MINUTE) {
      push({
        key: `dose_missed:${dose.doseId}`,
        kind: "dose_missed",
        recipients: recipientsFor(members, ELDER_SIDE, "doseMissed"),
        dose,
      });
    }
  }

  /* ---- Appointments ---- */
  for (const appt of input.appointments) {
    const start = new Date(appt.startsAt).getTime();
    if (start <= t) continue;
    const everyone = recipientsFor(members, [...ELDER_SIDE, ...SUPPORT_SIDE], "appointments");
    if (start - t <= APPOINTMENT_SOON_HOURS * HOUR) {
      push({ key: `appointment_soon:${appt.id}`, kind: "appointment_soon", recipients: everyone, appointment: appt });
    } else if (start - t <= APPOINTMENT_DAY_BEFORE_HOURS * HOUR) {
      push({
        key: `appointment_day_before:${appt.id}`,
        kind: "appointment_day_before",
        recipients: everyone,
        appointment: appt,
      });
    }
  }

  /* ---- Refills (at most once per medication per day) ---- */
  for (const med of input.medications) {
    if (!med.active) continue;
    const daysLeft = daysOfSupplyLeft(med);
    if (daysLeft === null || daysLeft > med.refillThreshold) continue;
    push({
      key: `refill_low:${med.id}:${input.localToday}`,
      kind: "refill_low",
      recipients: recipientsFor(members, [...ELDER_SIDE, ...SUPPORT_SIDE], "refills"),
      medication: { id: med.id, name: med.name, pillsRemaining: med.pillsRemaining },
      daysLeft,
    });
  }

  return actions;
}

/** Sensible notification defaults per role (members can change them later). */
export function defaultNotifyPrefs(role: Member["role"]): NotifyPrefs {
  switch (role) {
    case "elder":
      return { doseUpcoming: true, doseMissed: true, escalation: false, appointments: true, refills: true };
    case "caretaker":
      return { doseUpcoming: false, doseMissed: false, escalation: true, appointments: true, refills: true };
    case "organiser":
      return { doseUpcoming: false, doseMissed: false, escalation: true, appointments: true, refills: true };
    case "family":
      return { doseUpcoming: false, doseMissed: false, escalation: true, appointments: true, refills: false };
    case "doctor":
      return { doseUpcoming: false, doseMissed: false, escalation: false, appointments: false, refills: false };
  }
}
