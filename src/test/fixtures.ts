import { defaultNotifyPrefs } from "@/lib/domain/reminders";
import type { Appointment, CircleRole, Medication, Member } from "@/lib/domain/schemas";

export const TZ = "Asia/Kolkata";

export function med(overrides: Partial<Medication> = {}): Medication {
  return {
    id: "med1",
    name: "Metformin",
    dose: "500 mg",
    instructions: "after food",
    times: ["08:00", "20:00"],
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startDate: "2026-11-01",
    pillsPerDose: 1,
    refillThreshold: 7,
    active: true,
    createdBy: "u-elder",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

export function member(role: CircleRole, overrides: Partial<Member> = {}): Member {
  return {
    id: `u-${role}`,
    name: role[0].toUpperCase() + role.slice(1),
    email: `${role}@example.com`,
    role,
    notify: defaultNotifyPrefs(role),
    joinedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

export function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "appt1",
    doctorName: "Dr. Rao",
    specialty: "Cardiology",
    date: "2026-11-16",
    time: "10:00",
    durationMinutes: 30,
    startsAt: "2026-11-16T04:30:00.000Z",
    createdBy: "u-elder",
    ...overrides,
  };
}
