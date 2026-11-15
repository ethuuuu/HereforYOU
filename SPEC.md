# SPEC — Here For YOU

Build in this order. Each feature is a vertical slice (UI → route → data → tests).
Tick boxes as you go. Feature 3 complete + deployed = a valid submission; everything after improves the score.

## F0 · Foundation (≈30 min)
- [x] App shell: `layout.tsx` with skip link, header (app name + signed-in user + sign out), `<main id="main">`, footer; `lang="en"`; base font 18px in elder mode, 16px standard.
- [x] Design primitives in `src/components/ui/`: `Button` (≥48px, variants primary/secondary/danger, loading state), `Field` (label, hint, error via `aria-describedby`), `Card`, `Toast` (aria-live), `ReadAloud`.
- [x] Accessibility prefs: `largeText` + `highContrast` classes on `<html>` from user prefs (cookie for signed-out users).
- [x] `src/lib/http.ts`: `json()`, `withCircle()` error mapping (401/403/400/404/500) + tests.
- [x] Security headers in `next.config.ts`.
- [x] Landing page `/`: what Here For YOU does (3 benefits), "Get started" and "Sign in".
- Done when: `/api/health` shows all integrations `true`; Lighthouse accessibility on `/` ≥ 95.

## F1 · Accounts (≈1 h 30)
**F1a — Google sign-in + sessions (do first)**
- [x] `/signin`: "Continue with Google" (Firebase popup) → `POST /api/session` → redirect.
- [x] `POST /api/session` (ID token → cookie), `DELETE /api/session` (sign out) + tests.
- [x] `users/{uid}` created on first sign-in (`src/lib/data/users.ts`).
- Done when: sign in, refresh, still signed in; sign out works.

**F1b — Passkeys (timebox 75 min; if blocked, move to F2 and return after F5)**
- [x] Routes: `/api/passkeys/register/{options,verify}`, `/api/passkeys/login/{options,verify}` per AGENTS.md §8.
- [x] `passkeys/{credentialId}` + `webauthnChallenges` repositories; challenges expire in 5 min.
- [x] `/signin`: big "Sign in with fingerprint or face" button above Google. "Create account with a passkey" on `/welcome`.
- [x] Settings: list passkeys, add another, remove one.
- [x] Tests for verify routes with `@simplewebauthn/server` mocked (success, bad challenge, expired, unknown credential).
- Done when: create account with a passkey on localhost, sign out, sign back in with the passkey.

## F2 · Role-based onboarding & care circles (≈1 h 30)
- [ ] `/welcome` — "Who's setting this up?" four large cards: **Myself (I'm the elder)**, **My parent or relative**, **I'm a caretaker**, **I'm a doctor**.
- [ ] Tailored setup per role (AGENTS.md §1, §6):
  - Elder: large text on, simple steps — name, time zone, create passcode, invite people.
  - Family: parent's name/email/time zone, passcode, then "Hand the phone to {name}" claim screen with claim code.
  - Caretaker / Doctor: "Join a circle" (code + passcode) or "Create one for a client/patient".
- [ ] `POST /api/circles` (create), `POST /api/circles/join` (with lockout), `POST /api/circles/[id]/claim`.
- [ ] Members page: list, role badges; elder can change roles / remove (rules in `canChangeRole`), rotate passcode, edit notification prefs.
- [ ] Share card: circle code + "how to join" text (passcode never shown again after creation).
- [ ] Activity log page (`activity` collection), newest first.
- [x] Medicines permission: only the circle creator (and the elder after claim) may add medicines until they allow others with the "Can add and edit medicines" switch on People; doctors are always allowed (AGENTS.md §6). Enforced in `withCircle` + medicines pages; tests.
- [ ] Tests: create/join/lockout/claim/role-change routes; permission denials.
- Done when: elder creates circle on one browser, family joins with code+passcode on another, elder upgrades them to caretaker, activity log shows each step.

## F3 · Medicines, Today view & adherence (≈1 h 15)
- [x] Medicines list + add/edit/deactivate form (`MedicationInputSchema`): name, dose, purpose, instructions, times (add/remove), days of week, start/end, pills remaining, prescribed by.
- [x] **Today** (`/c/[id]`, default for elder): doses for today in order, each a big card with state (Upcoming / Due now / ✓ Taken / Skipped / ! Missed), "I took it" and "Skip" buttons, read-aloud.
- [x] `POST /api/circles/[id]/doses` logs taken/skipped (doctor can't; family can confirm) → activity entry; decrement `pillsRemaining` on taken.
- [x] Adherence panel: this week's rate, streak, missed list (uses `summarizeAdherence`, `adherenceStreak`).
- [x] Refill badge when `daysOfSupplyLeft ≤ refillThreshold`.
- [x] Tests: dose logging route, today view interaction (mark taken updates UI).
- Done when: add a medicine for now+2 min, it appears on Today, "I took it" turns it ✓ and adherence updates.

## F4 · Appointments (≈45 min)
- [x] List (upcoming / past) + add/edit/delete form (`AppointmentInputSchema`); server computes `startsAt` with `zonedToUtc`.
- [x] Each appointment: **Add to Google Calendar** (`googleCalendarUrl`) and **Directions** (`googleMapsUrl`).
- [x] Next appointment card on Today.
- [x] Tests: create route computes `startsAt` in the circle time zone; calendar link present.

## F5 · Reminder emails (≈1 h)
- [x] `src/lib/data/*` queries for the runner (AGENTS.md §9 read budget).
- [x] `src/lib/reminders/runner.ts`: per circle → `planReminders` → `renderReminder` → `sendEmail` per recipient → record `sentReminders/{key}`.
- [x] `GET|POST /api/reminders/run` with `authorizeTrigger`; `POST /api/circles/[id]/reminders/run-now`.
- [x] "Send reminders now" button on the members/settings page (elder/caretaker/organiser) showing results in a live region.
- [x] Notification preferences per member (checkboxes for each kind).
- [x] Tests: runner with mocked data + mailer (sends, skips already-sent, one failure doesn't stop others); route rejects unsigned calls (401).
- Done when: a medicine due 15 min ago with no log → "Send reminders now" → elder receives the missed email; pressing again sends nothing.

## F6 · Gemini features (≈45 min)
- [x] `src/lib/ai/prompts.ts`: `prescriptionPrompt` + `PrescriptionDraftSchema` (array of medication drafts + `uncertain` notes); `visitQuestionsPrompt` + schema.
- [x] "Add from prescription": paste text **or** upload a photo (≤ 4 MB jpeg/png/webp) → editable draft cards → confirm saves selected.
- [x] Appointment: "Suggest questions for this visit" → saved to `appointment.questions`, shown and included in reminder emails.
- [x] Notice under AI output; loading + error + retry states; read-aloud.
- [x] Tests: AI routes with `generateJSON` mocked (valid, invalid input 400, AI error 502); prompt builders include user data inside `<user_input>`.

## F7 · Role dashboards & polish (remaining time)
- [x] Two UI modes (AGENTS.md §12): elder mode (18px, 48px targets, calm motion) from `setupRole`, standard mode (16px, 44px targets, fluid motion) for everyone else; "Simple large layout" switch in the Accessibility menu.
- [ ] Caretaker home: all circles they belong to, today's due/missed doses across them.
- [ ] Doctor report `/c/[id]/report`: medicines, 30-day adherence, missed doses, printable (`@media print`).
- [ ] Family home: "Is Mum OK today?" summary card (adherence today + next appointment).
- [ ] Stretch: weekly Gemini summary email; high-contrast theme polish; empty states everywhere.

## F8 · Assistant (chat + voice + tool calling)
- [x] `/c/[id]/assistant` (nav "Assistant" + "Ask the assistant" on Today): chat log (`aria-live`), text box + Send, **Speak** (MediaRecorder → Gemini transcription), replies read aloud (Gemini TTS) with the AI notice.
- [x] `POST /api/circles/[id]/assistant` (`ai.use`): Gemini function calling via `chatWithTools`. Read tools run at once: `get_today_doses`, `get_medicines`, `get_upcoming_visits`, `get_people`. Action tools only return a **pending** action: `log_dose`, `schedule_visit` (+ Google Calendar link), `create_task` (`circles/{id}/tasks`, shown on Today), `send_email` (Gmail; recipients by name/role, mapped server-side).
- [x] Confirm: `{ confirm: { tool, args } }` → zod re-validation + the tool's own permission → execute → activity entry.
- [x] `POST /api/circles/[id]/assistant/transcribe`: webm/ogg/mp4/mp3/wav, ≤ 2 MB, base64 JSON.
- [x] Tests: helper (SDK mocked), routes (pending not executed, confirm + 403/400, email mapping + escaping, transcribe limits), chat UI.

## Ship (from 3:30)
- [ ] `/ship` command: lint, typecheck, tests, build, security + accessibility pass.
- [ ] README rewritten (problem → solution → features → Google services → architecture → setup → tests).
- [ ] Vercel env vars set; QStash schedule active; live smoke test of the demo script.

## Cut order if behind
F7 stretch → doctor report → caretaker multi-circle home → photo upload (keep pasted text) → weekly summary → passkey management page (keep passkey sign-in).

## 60-second demo script
1. Asha (elder) signs in with her fingerprint, sees **Today**: 8 AM Metformin due, big "I took it".
2. Her daughter joins with the circle code + passcode; Asha upgrades her to caretaker — activity log shows it.
3. Paste a prescription → Gemini drafts two medicines → Asha confirms.
4. A dose is missed → "Send reminders now" → Asha gets "Did you take…?"; an hour later her daughter gets the escalation.
5. Tomorrow's cardiology visit: Add to Google Calendar + Gemini's suggested questions.
