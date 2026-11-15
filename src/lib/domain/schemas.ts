/**
 * Single source of truth for data shapes. Every API route validates its input
 * with one of these schemas; Firestore documents follow the matching types.
 */
import { z } from "zod";
import type { DisplayPrefs } from "@/lib/prefs";
import { isLocalDate, isLocalTime } from "./time";

/* ---------- Roles ---------- */

/** Who is using the platform, as chosen on the "Who's setting this up?" screen. */
export const SETUP_ROLES = ["elder", "family", "caretaker", "doctor"] as const;
export const SetupRoleSchema = z.enum(SETUP_ROLES);
export type SetupRole = z.infer<typeof SetupRoleSchema>;

/**
 * Role inside a care circle. "organiser" = a non-elder who created the profile
 * and keeps full edit rights until the elder claims ownership.
 */
export const CIRCLE_ROLES = ["elder", "organiser", "caretaker", "doctor", "family"] as const;
export const CircleRoleSchema = z.enum(CIRCLE_ROLES);
export type CircleRole = z.infer<typeof CircleRoleSchema>;

/* ---------- Primitives ---------- */

const name = z.string().trim().min(1, "Required").max(80);
const shortText = z.string().trim().max(300);
const longText = z.string().trim().max(2000);
export const LocalDateSchema = z.string().refine(isLocalDate, "Use YYYY-MM-DD");
export const LocalTimeSchema = z.string().refine(isLocalTime, "Use HH:MM (24h)");
export const TimeZoneSchema = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, "Unknown time zone");

/** 6–12 digit numeric passcode for joining a care circle. */
export const PasscodeSchema = z
  .string()
  .regex(/^\d{6,12}$/, "Passcode must be 6–12 digits")
  .refine((v) => !/^(\d)\1+$/.test(v) && !"0123456789012345".includes(v), "Passcode is too easy to guess");

/** Short human-shareable code that identifies a care circle, e.g. "HFY-7K3P9Q". */
export const CircleCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^HFY-[A-Z0-9]{6}$/, "Code looks like HFY-XXXXXX");

/* ---------- Notification preferences ---------- */

export const NotifyPrefsSchema = z.object({
  doseUpcoming: z.boolean(),
  doseMissed: z.boolean(),
  escalation: z.boolean(),
  appointments: z.boolean(),
  refills: z.boolean(),
});
export type NotifyPrefs = z.infer<typeof NotifyPrefsSchema>;

/* ---------- Users ---------- */

/** users/{uid}. setupRole is set on the "Who's setting this up?" screen, so it's missing at first. */
export type UserProfile = {
  displayName: string;
  email?: string;
  setupRole?: SetupRole;
  circleIds: string[];
  prefs: DisplayPrefs;
  createdAt: string; // ISO
};

/* ---------- Profile (care circle) ---------- */

export const CreateProfileSchema = z.object({
  setupRole: SetupRoleSchema,
  elderName: name,
  elderEmail: z.email().optional(),
  timezone: TimeZoneSchema.default("Asia/Kolkata"),
  passcode: PasscodeSchema,
  largeText: z.boolean().default(true),
});
export type CreateProfileInput = z.infer<typeof CreateProfileSchema>;

export const JoinCircleSchema = z.object({
  circleCode: CircleCodeSchema,
  passcode: z.string().regex(/^\d{6,12}$/),
  displayName: name,
  setupRole: SetupRoleSchema.exclude(["elder"]),
});
export type JoinCircleInput = z.infer<typeof JoinCircleSchema>;

/* ---------- Members ---------- */

export type Member = {
  id: string; // Firebase Auth uid
  name: string;
  email?: string;
  role: CircleRole;
  notify: NotifyPrefs;
  joinedAt: string; // ISO
  /** May add/edit medicines. Creator, elder and doctors always; others when the owner allows. See canEditMedicines. */
  medsAuthorized?: boolean;
};

/* ---------- Circles ---------- */

/** circles/{circleId}. Secrets (passcodeHash, claimCodeHash) never leave the server. */
export type Circle = {
  id: string;
  code: string;
  elderName: string;
  elderEmail?: string;
  timezone: string;
  passcodeHash: string;
  failedAttempts: number;
  lastFailedAt?: string; // ISO
  elderUid?: string; // set when the elder owns (created or claimed) the circle
  organiserUid?: string;
  claimCodeHash?: string;
  claimExpiresAt?: string; // ISO
  active: true;
  createdAt: string;
  createdBy: string;
};

/** circles/{id}/activity/{autoId} — every change, in plain words. */
export type ActivityEntry = {
  id: string;
  actorUid: string;
  actorName: string;
  action: string; // e.g. "member.role_changed"
  summary: string; // e.g. "Asha made Priya a caretaker"
  at: string; // ISO
};

/** The elder takes over a circle a relative set up: circle code + one-time 6-digit claim code. */
export const ClaimCircleSchema = z.object({
  circleCode: CircleCodeSchema,
  claimCode: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});
export type ClaimCircleInput = z.infer<typeof ClaimCircleSchema>;

/** Elder status only comes from creating or claiming a circle, never from a role change. */
export const ASSIGNABLE_ROLES = ["caretaker", "doctor", "family"] as const;
export const ChangeRoleSchema = z.object({ role: z.enum(ASSIGNABLE_ROLES) });
export const MedsAuthorizedSchema = z.object({ medsAuthorized: z.boolean() });

export const RotatePasscodeSchema = z.object({ passcode: PasscodeSchema });

/* ---------- Medications ---------- */

export const MedicationInputSchema = z
  .object({
    name: name,
    dose: z.string().trim().min(1).max(60), // "500 mg", "1 tablet"
    instructions: shortText.optional(), // "after food"
    times: z.array(LocalTimeSchema).min(1).max(8),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0, 1, 2, 3, 4, 5, 6]),
    startDate: LocalDateSchema,
    endDate: LocalDateSchema.optional(),
    pillsRemaining: z.number().int().min(0).max(10_000).optional(),
    pillsPerDose: z.number().int().min(1).max(20).default(1),
    refillThreshold: z.number().int().min(0).max(1000).default(7),
    prescribedBy: name.optional(),
    purpose: shortText.optional(), // plain-language "for blood pressure"
  })
  .refine((m) => !m.endDate || m.endDate >= m.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });
export type MedicationInput = z.infer<typeof MedicationInputSchema>;

export type Medication = MedicationInput & {
  id: string;
  active: boolean;
  createdBy: string;
  updatedAt: string;
};

/* ---------- Dose log ---------- */

export const DOSE_STATUSES = ["taken", "skipped"] as const;
export const DoseStatusSchema = z.enum(DOSE_STATUSES);
export type DoseStatus = z.infer<typeof DoseStatusSchema>;

export const LogDoseSchema = z.object({
  doseId: z.string().min(1).max(120),
  status: DoseStatusSchema,
  note: shortText.optional(),
});

export type DoseLog = {
  doseId: string; // `${medicationId}_${localDate}_${HHMM}`
  medicationId: string;
  localDate: string; // YYYY-MM-DD in the circle timezone — lets us query a day's logs in one go
  status: DoseStatus;
  loggedBy: string;
  loggedAt: string; // ISO
  note?: string;
};

/* ---------- Appointments ---------- */

export const AppointmentInputSchema = z.object({
  doctorName: name,
  specialty: z.string().trim().max(60).optional(),
  date: LocalDateSchema,
  time: LocalTimeSchema,
  durationMinutes: z.number().int().min(5).max(480).default(30),
  location: shortText.optional(),
  reason: shortText.optional(),
  notes: longText.optional(),
});
export type AppointmentInput = z.infer<typeof AppointmentInputSchema>;

export type Appointment = AppointmentInput & {
  id: string;
  startsAt: string; // UTC ISO, computed from date + time + profile timezone
  createdBy: string;
  questions?: string[]; // Gemini-suggested questions for the doctor
};

/* ---------- AI requests ---------- */

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
// First bytes of each allowed format, base64-encoded (WebP is checked for "RIFF" then "WEBP").
const MAGIC: Record<(typeof IMAGE_TYPES)[number], (head: string) => boolean> = {
  "image/jpeg": (h) => h.startsWith("\xFF\xD8\xFF"),
  "image/png": (h) => h.startsWith("\x89PNG"),
  "image/webp": (h) => h.startsWith("RIFF") && h.slice(8, 12) === "WEBP",
};
const decodeHead = (b64: string) => {
  try {
    return atob(b64.slice(0, 16));
  } catch {
    return "";
  }
};

export const ImageUploadSchema = z
  .object({
    mimeType: z.enum(IMAGE_TYPES, "Use a JPEG, PNG or WebP photo"),
    base64: z
      .string()
      .max(Math.ceil(MAX_IMAGE_BYTES / 3) * 4, "The photo must be 4 MB or smaller")
      .regex(/^[A-Za-z0-9+/]+={0,2}$/, "That photo could not be read"),
  })
  .refine((img) => MAGIC[img.mimeType](decodeHead(img.base64)), {
    message: "That file is not a JPEG, PNG or WebP photo",
    path: ["base64"],
  });

export const PrescriptionRequestSchema = z
  .object({
    text: z.string().trim().max(4000, "Keep the text under 4,000 characters").optional(),
    image: ImageUploadSchema.optional(),
  })
  .refine((b) => b.text || b.image, { message: "Paste the prescription or add a photo", path: ["text"] });

export const SaveQuestionsSchema = z.object({
  questions: z.array(z.string().trim().min(1).max(140)).max(5),
});
