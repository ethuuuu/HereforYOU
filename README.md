# hereforYOU
https://here-for-you-azure.vercel.app/c/bv5Z7zAfQhZxCfu2Con6
**A shared healthcare companion that keeps elderly people at the centre of their own care.**

Live demo: https://here-for-you-azure.vercel.app

## Chosen vertical

**Healthcare — elderly care management.** A smart, interconnected platform that helps older people
manage daily medicines, doctor visits and routines, while keeping family, caretakers and doctors
informed through secure, passcode-based access — with the elder always in charge.

## The problem

Older people juggle several medicines a day, appointments and refills, while family and carers
worry from a distance. Plain reminder apps nag one person and stop there; they don't know who else
should be told, who may change what, or how to stay usable for someone with weaker eyesight.

## Approach and logic

One elder's health profile is a **care circle**. People join it with a **circle code + passcode**
and get a **role** that decides what they can see and do. Every decision is driven by the user's
context — role, time zone, what is due now, and what has already been logged.

| Context | Decision the system makes |
|---|---|
| **Who you are** (elder / organiser / caretaker / doctor / family) | A permission matrix (`src/lib/auth/permissions.ts`) checked on the server for every request. Doctors see medicines and visits but not the member list; family can confirm a dose but not edit medicines. |
| **Who may change medicines** | Only the circle's creator (and the elder once they claim the circle) — they authorise others one by one. Doctors are authorised automatically. Enforced centrally in `withCircle()`. |
| **What time it is for the elder** | All schedules are computed in the elder's time zone (`src/lib/domain/time.ts`), so a dose is "Upcoming", "Due now", "✓ Taken", "Skipped" or "! Missed" correctly wherever family live. |
| **Whether a dose was missed** | The reminder planner (`src/lib/domain/reminders.ts`) escalates: **15 min before** → elder; **30 min after**, not logged → elder; **60 min after** → caretakers/family who opted in. Appointments: the day before and 2 h before. Low pill supply → refill email. Each reminder is sent once (idempotency keys). |
| **Is this person the elder?** | Elders get a calm **large layout** (18 px+ text, 48 px+ targets, gentle motion); everyone else gets a standard fluid UI. Anyone can switch in the Accessibility menu. |
| **Is an AI action safe?** | The assistant only *proposes* actions; nothing changes until the person taps **"Yes, do it"**, and the server re-validates and re-checks permissions before running it. |

The elder stays in control: they own the circle, approve roles, decide who may edit medicines,
and an **activity log** records every change by anyone.

## How the solution works

- **Care circles & onboarding** — "Who's setting this up?" (elder, relative, caretaker, doctor) with tailored setup. A relative can create a circle and hand the elder a one-time **claim code** to take ownership.
- **Today** — the day's doses as big cards with "I took it" / "Skip", weekly adherence rate, streak, missed doses, refill warnings, next visit and to-dos, with **Read aloud**.
- **Medicines** — add / edit / stop, times and days, pill counts; **Add from prescription**: paste text or a photo → Gemini drafts editable medicines → saved only after confirmation.
- **Visits** — appointments with **Add to Google Calendar**, **Directions** (Google Maps) and Gemini-suggested **questions for the doctor**.
- **Assistant** — the elder can **type or speak**. Gemini function calling answers questions (today's doses, medicines, visits, people) and proposes actions — log a dose, schedule a visit, create a to-do, email circle members — each confirmed by the user first.
- **Email reminders** — a runner triggered every 5 minutes (Upstash QStash) and daily (Vercel Cron) sends upcoming / missed / escalation / appointment / refill emails via Gmail, respecting each member's notification choices. "Send reminders now" for demos.
- **Accessibility menu** — Simple large layout, Larger text, High contrast, Bigger buttons, Reduce motion, Solid backgrounds. Light/dark follows the device.
- **Sign-in** — Google, or **passkeys** (fingerprint / face) so elders never need a password.

## Google services used

| Service | Where |
|---|---|
| **Gemini API** (`@google/genai`) | Prescription → draft medicines (structured JSON output), visit questions, assistant **function calling**, voice **transcription**, natural **text-to-speech** (`src/lib/ai/gemini.ts`) |
| **Firebase Authentication** | Google sign-in; custom tokens for passkeys; session cookies |
| **Cloud Firestore** | All data, server-side only via firebase-admin (`firestore.rules` deny all client access) |
| **Gmail** | Reminder and assistant emails (`src/lib/email/mailer.ts`) |
| **Google Calendar / Google Maps** | "Add to Google Calendar" and "Directions" links (`src/lib/calendar.ts`) |

## Architecture

```
src/
  app/            Next.js 16 App Router pages (Server Components) + API route handlers
  components/     Accessible UI (ui/ primitives, today/, medications/, appointments/, assistant/, circle/)
  lib/
    domain/       Pure, tested logic: time zones, schedules, adherence, reminder planning, zod schemas
    auth/         Sessions, passkeys (WebAuthn), passcodes (scrypt), permissions, trigger auth
    data/         Firestore repositories (one per collection), transactions, activity log, rate limits
    ai/           The only Gemini client + prompts
    email/        Gmail mailer + escaped templates
    reminders/    Reminder runner
```

Every circle route goes through `withCircle()` (`src/lib/http.ts`): signed in → member of the circle →
role allowed → handler, with safe JSON errors. Pages read Firestore directly on the server; mutations
go through validated route handlers.

## Security

- Every request body validated with **zod** (length caps); JSON-only mutations (CSRF); membership + permission checks on every circle route; circle and ids never trusted from the client.
- Passcodes and claim codes **scrypt-hashed**, constant-time compare, **lockout** after 5 failures.
- httpOnly secure session cookies; revocation checked on API calls; passkey challenges one-time and expiring.
- **Rate limits** on every paid Gemini call and on assistant emails; strict **CSP** and security headers.
- No secrets in client code; logs contain sizes and timings only — never prompts, emails or tokens; HTML-escaped emails.
- AI never writes data on its own: every AI result is confirmed by a person.

## Efficiency

- Functions run in Mumbai (`bom1`) next to Firestore (`asia-south1`); signed-in pages load in ~100 ms.
- Firestore queries filter server-side; the reminder runner stays within the free-plan read budget.
- Session checked once per request (cached); instant loading skeletons; photos resized in the browser before upload; Gemini structured output and minimal thinking for fast extraction.

## Accessibility

Elder mode (large text, 48 px targets), WCAG AAA colour contrast (≥ 7:1) in light, dark and high-contrast themes,
never colour alone for status, full keyboard use, visible focus, skip link, labelled fields with linked errors,
`aria-live` results, Read aloud with Gemini's natural voice, and Reduce motion / Solid backgrounds switches.

## Testing

**320 tests** (Vitest + Testing Library): pure domain logic, every route handler (with Firestore, Gemini and
Gmail mocked), permissions, security cases (rate limits, revoked sessions, lockout), and accessible
interaction tests that query by role and label.

```bash
npm test            # run all tests
npm run typecheck   # TypeScript strict
npm run lint
npm run build
```

## Run it locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in: Firebase service account + web config, `GEMINI_API_KEY` / `GEMINI_MODEL`, Gmail user + app password, QStash signing keys, `CRON_SECRET`, `WEBAUTHN_RP_ID`, `APP_URL`.
3. `npm run dev` → http://localhost:3000 (`/api/health` shows which integrations are configured).

## Assumptions

- One care circle per elder; people can belong to several circles. A relative may set it up, but the elder can claim ownership.
- Times are entered and shown in the elder's time zone.
- Email is the reminder channel (no SMS/push); reminders run every 5 minutes, so they can be up to ~5 minutes late.
- The assistant and AI features give suggestions only — they never diagnose or change doses; a doctor or pharmacist decides.
- Gemini models and voices are configurable via environment variables.
