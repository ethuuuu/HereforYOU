<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Here For YOU

Rules and architecture for every coding agent working in this repo. Read this fully
before writing code. The build plan and progress live in `SPEC.md`; the original
challenge text is in `PROBLEM.md`.

---

## 1. What we are building

**Here For YOU** is a shared healthcare companion for elderly people. One elder's
health profile — medicines, doses, appointments — is a **care circle** that the elder,
family, caretakers and doctors can join with a **passcode**. The platform sends
**email reminders** (upcoming doses, missed doses, appointments) and escalates to the
right people when something is missed. **The elder stays in charge**: they own the
circle, approve roles, and see every change others make.

How we go beyond a reminder app:
1. **Escalation ladder** — remind the elder first, then alert caretakers/family only if a dose is still missed.
2. **Role-tailored experience** — setup and dashboards differ for elder, family, caretaker and doctor.
3. **Elder ownership** — the elder claims and controls their circle; an activity log shows every change.
4. **Gemini assistance** — paste or photograph a prescription → a draft schedule the elder confirms; suggested questions before a doctor visit; a plain-language weekly summary.
5. **Accessibility first** — large text, big targets, high contrast, read-aloud, passkeys instead of passwords.

## 2. Scoring we optimise for (automated code assessment)

Code quality · Security · Efficiency · Testing · Accessibility · Problem-statement
alignment · **Google services usage**. Every change should help at least one of these
and hurt none. When in doubt, prefer the simpler, well-tested, accessible option.

Google services used (keep them visible in code and README):
**Firebase Authentication** (Google sign-in + custom tokens for passkeys) ·
**Cloud Firestore** · **Gemini API** (`@google/genai`) · **Gmail** (SMTP sender) ·
**Google Calendar** links · **Google Maps** links.

## 3. Stack (do not change without asking)

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript (strict) + Tailwind CSS v4 |
| Hosting | Vercel (Hobby). Daily cron in `vercel.json` |
| Database | Cloud Firestore via **firebase-admin on the server only** |
| Auth | Firebase Auth: Google sign-in + passkeys (`@simplewebauthn/*` v14) → custom token → Firebase **session cookie** |
| AI | Gemini via `@google/genai` — only through `src/lib/ai/gemini.ts` |
| Email | Gmail via `nodemailer` — only through `src/lib/email/mailer.ts` |
| Reminder trigger | Upstash QStash schedule every 5 min → `POST /api/reminders/run`; Vercel cron daily → `GET` same route |
| Validation | `zod` v4 (`src/lib/domain/schemas.ts`) |
| Tests | Vitest + Testing Library |

Library APIs change often. Before using an API you are not certain about, check
`node_modules/<pkg>` types, `node_modules/next/dist/docs/`, or the Context7 MCP server.

## 4. Commands

```bash
npm run dev         # local dev on http://localhost:3000
npm run typecheck   # next typegen && tsc --noEmit
npm test            # vitest run
npm run coverage    # coverage report for src/lib
npm run lint        # eslint
npm run build       # production build
```
Do not start `npm run dev` yourself unless asked — it never exits. Verify with typecheck, tests and build.

## 5. Folder structure

```
src/
  app/
    (public)/            landing, sign-in, welcome (role picker), join
    c/[circleId]/        circle area: today, medications, appointments, members, activity, report
    settings/            accessibility + notifications + passkeys
    api/                 route handlers (mutations, auth, reminders, AI)
  components/            UI components (accessible, small, typed props)
    ui/                  primitives: Button, Field, Card, Dialog, Toast, ReadAloud
  lib/
    domain/              PURE logic: time, schedule, adherence, reminders, schemas   ✅ built
    auth/                passcode, permissions, triggers, session                    ✅ built
    firebase/            admin (server), client (browser sign-in only)               ✅ built
    ai/                  gemini.ts, json.ts, prompts.ts                              ✅ built (prompts.ts: you)
    email/               mailer.ts, templates.ts                                     ✅ built
    data/                Firestore repositories — one file per collection            ⬜ you
    http.ts              route helpers: withCircle(), json errors                     ⬜ you
    calendar.ts          Google Calendar / Maps links                                ✅ built
  test/                  fixtures + stubs
```
Tests live next to code: `thing.ts` → `thing.test.ts`.

**Already built and tested (61 tests) — reuse, don't rewrite:** time-zone maths, dose
schedule expansion, adherence + streaks, the reminder planner with escalation,
passcode hashing + lockout + circle codes, the permissions matrix, trigger
authentication (QStash/Vercel cron), Gemini client with validated JSON, email
templates, Calendar/Maps links, env validation, Firebase admin/client, session cookies.

## 6. Roles and permissions

Setup roles (the "Who's setting this up?" screen): `elder`, `family`, `caretaker`, `doctor`.
Circle roles: `elder`, `organiser`, `caretaker`, `doctor`, `family`.

- **elder** — owns the circle. Everything, including managing members and roles.
- **organiser** — a non-elder who created the circle. Full rights **until the elder claims it**; then becomes `caretaker`.
- **caretaker** — edits medicines and appointments, logs doses, sees reports and activity.
- **doctor** — adds/edits prescriptions and appointments, views adherence reports. No member list.
- **family** — views, gets alerts, can confirm a dose was taken ("I saw Mum take it").

The matrix lives in `src/lib/auth/permissions.ts`. **Every route that touches circle
data calls `assertCan(role, action)` after confirming membership.** People who join
with the passcode start as `family`; only the elder (or organiser before claim) can
upgrade them. Nobody can demote or remove the elder.

## 7. Firestore data model

All timestamps are ISO-8601 strings in UTC. Local dates/times (`YYYY-MM-DD`, `HH:MM`)
are always in the circle's `timezone`.

```
users/{uid}
  displayName, email?, setupRole, circleIds: string[], prefs: { largeText, highContrast, readAloud }, createdAt

passkeys/{credentialId}                 # top-level so sign-in can look up by credential id
  uid, publicKey (base64url), counter, transports[], deviceName, createdAt, lastUsedAt

webauthnChallenges/{challengeId}        # short-lived; id stored in an httpOnly cookie
  challenge, uid?, purpose: "register" | "login", expiresAt

circleCodes/{code}                      # "HFY-7K3P9Q" → circleId (unique lookup)
  circleId

circles/{circleId}
  code, elderName, elderEmail?, timezone, passcodeHash,
  failedAttempts, lastFailedAt?, elderUid? (set when claimed), organiserUid?,
  claimCodeHash?, claimExpiresAt?, active: true, createdAt, createdBy

circles/{circleId}/members/{uid}        # Member type in schemas.ts
circles/{circleId}/medications/{medId}  # Medication type
circles/{circleId}/doseLogs/{doseId}    # DoseLog type; doseId = `${medId}_${YYYY-MM-DD}_${HHMM}`
circles/{circleId}/appointments/{id}    # Appointment type (startsAt computed server-side)
circles/{circleId}/tasks/{autoId}       # { title, date, time?, createdBy, createdAt } — assistant to-dos, shown on Today
circles/{circleId}/activity/{autoId}    # { actorUid, actorName, action, summary, at }
circles/{circleId}/sentReminders/{key}  # { kind, sentAt, recipientCount } — idempotency
```

Rules for data code (`src/lib/data/*`):
- One repository file per collection; functions take plain typed objects and return typed objects. No Firestore types leak into UI.
- Membership changes update `circles/.../members/{uid}` **and** `users/{uid}.circleIds` in one **transaction**.
- Every mutation writes an `activity` entry (who, what, plain-language summary).
- `firestore.rules` denies all client access. Never use the Firestore client SDK in the browser.

## 8. Authentication & access flows

**Sessions.** The browser signs in with Firebase Auth, gets an ID token, and POSTs it
to `/api/session`, which calls `createSession()` (httpOnly session cookie, 5 days).
Server code reads the user with `getSessionUser()` / `requireUser()`.

**Google sign-in** (build first — it's the fallback): Firebase client `signInWithPopup(googleProvider)`.

**Passkeys** (primary for elders) with `@simplewebauthn/server` + `@simplewebauthn/browser` v14:
- *Create account / add passkey:* `POST /api/passkeys/register/options` → browser `startRegistration({ optionsJSON })` → `POST /api/passkeys/register/verify` → store in `passkeys/{credentialId}` → for new users create the Firebase user (`adminAuth().createUser`) → return `createCustomToken(uid)` → browser `signInWithCustomToken` → `/api/session`.
- *Sign in:* discoverable credentials (`residentKey: "required"`, no `allowCredentials`) → `POST /api/passkeys/login/options` → `startAuthentication({ optionsJSON })` → `POST /api/passkeys/login/verify` → look up `passkeys/{id}`, verify, update counter → custom token → session.
- Challenges expire after 5 minutes and are deleted after use. `rpID` = `WEBAUTHN_RP_ID`; expected origin = `APP_URL`.
- Always offer "Continue with Google" next to the passkey button.

**Care circles (the passcode requirement).**
- *Create:* setup role + elder details + timezone + passcode (`CreateProfileSchema`) → `generateCircleCode()` → hash passcode → creator becomes `elder` (if setup role is elder) or `organiser`.
- *Join:* `JoinCircleSchema` (circle code + passcode + name + setup role). Check `isLockedOut()` first; on failure increment `failedAttempts` (transaction); on success reset and add member as `family` with `defaultNotifyPrefs`. Same error message for wrong code and wrong passcode.
- *Elder claim:* when an organiser creates a circle, show a one-time 6-digit claim code (store hash, 7-day expiry). The elder signs in on their own device, enters it, becomes `elder`; the organiser becomes `caretaker`. Show "Waiting for {name} to confirm" until claimed.
- *Passcode rotation:* elder only (members.manage).

**Route pattern.** Build `withCircle(req, circleId, action, handler)` in `src/lib/http.ts`:
require user → load membership → `assertCan` → run handler → map errors
(`UnauthorizedError`→401, `ForbiddenError`→403, `ZodError`→400 with field messages,
not found→404, anything else→500 with a generic message, logged server-side).

## 9. Reminder engine

`src/lib/domain/reminders.ts` (`planReminders`) already decides what to send:
- dose **upcoming**: 15 min before → elder
- dose **missed**: 30 min after, not logged → elder
- **escalation**: 60 min after, not logged → caretaker/organiser/family who opted in
- **appointment**: the day before and 2 h before → everyone opted in
- **refill low**: when days of supply ≤ threshold, once per day
- ignores doses older than 6 h; respects each member's notify preferences.

The runner you build (`src/lib/reminders/runner.ts` + `/api/reminders/run`):
1. `authorizeTrigger(req, body)` — QStash signature (POST) or Vercel `CRON_SECRET` (GET). Otherwise 401.
2. Load active circles. For each: members, active medications, doseLogs for yesterday+today, appointments in the next 26 h, sentReminders keys for today (query by `sentAt` ≥ start of yesterday).
3. Build doses with `dosesForRange(meds, yesterday, today, tz)`, call `planReminders`.
4. For each action: render with `renderReminder`, send one email per recipient, then write `sentReminders/{key}`. A failure for one recipient must not block others.
5. Return `{ circles, sent, failed }` (counts only).
Also: `POST /api/circles/[id]/reminders/run-now` (elder/caretaker/organiser) runs the same logic for one circle — for demos.

**Firestore read budget** (free plan = 50K reads/day; the runner runs 288×/day):
query only what the planner needs, filter in the query (dates, `active == true`),
never read whole collections per run. Target < 30 reads per circle per run.

## 10. Gemini features

All model calls go through `src/lib/ai/gemini.ts` (`generateText`, `generateJSON`).
Prompts live in `src/lib/ai/prompts.ts` as named builders next to their zod output schemas.
- **Prescription → draft schedule:** text or photo (`images`) → `MedicationInput[]` draft. Shown as editable cards; **nothing is saved until the elder/caretaker confirms**.
- **Doctor visit prep:** adherence summary + notes → 3–5 plain questions, saved on the appointment.
- **Weekly summary (stretch):** adherence + upcoming → short, kind, plain-language paragraph.
- **Assistant** (`/c/[id]/assistant`, tools in `src/lib/assistant/tools.ts`): chat by text or voice
  (`transcribeAudio`), Gemini function calling via `chatWithTools`. Only tools the role may use are
  declared. Read tools run at once; **action tools never run on the model's say-so** — they return a
  pending action the person confirms ("Yes, do it"), then the route re-validates (zod) + `assertCan`
  and executes with an activity entry. People are named by display name/role, mapped to emails server-side.

Safety rules: wrap user text with `asUserData()`; the system prompt must say the
assistant does not diagnose or change doses and that a doctor or pharmacist decides;
show a one-line notice under AI output: "Suggestion only — check with your doctor or pharmacist."
Never send more personal data to the model than the feature needs (no emails, no uids).

## 11. Security rules (scored)

- Validate **every** request body/params with zod; cap string lengths (schemas already do).
- Authorise every circle route with membership + `assertCan`. Never trust a role or circleId from the client.
- Secrets only via `serverEnv()`; never `NEXT_PUBLIC_` for secrets; never log secrets, tokens, passcodes or emails.
- Passcodes: hashed (scrypt), constant-time compare, lockout after 5 failures for 15 min.
- Session cookie: httpOnly, secure in production, sameSite=lax. Sign-out clears it. Mutations accept JSON only.
- No `dangerouslySetInnerHTML`. Escape all user text in emails (`escapeHtml`).
- Error responses never include stack traces or internal messages.
- Add security headers in `next.config.ts` (CSP with `'self'` + Google sign-in domains, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` limiting camera and microphone to self).

## 12. Accessibility rules (scored — elders are the main users)

- **Two UI modes** (`src/lib/mode.ts`, `hfy_mode` cookie → `elder-mode` class on `<html>`, no Firestore read per page):
  - **Elder mode** — set at sign-in when `users/{uid}.setupRole === "elder"`, and when someone creates a circle as the elder or claims one. Base font ≥ 18px, `text-xs`/`text-sm` never below the base, touch targets ≥ 48×48px, calmer and shorter motion. **Large-text mode** (default on for new elders) ≥ 22px.
  - **Standard mode** — family, caretakers, doctors, organisers and signed-out visitors: 16px base, Tailwind's normal small sizes, targets ≥ 44×44px, fluid motion (hover lift, press, sliding tab underline, dropdown/page transitions, skeleton shimmer).
  - Anyone can switch with "Simple large layout" in the Accessibility menu; sign-out clears the mode. Style mode differences with the `elder:` variant (e.g. `text-base elder:text-lg`) or CSS variables under `.elder-mode`.
- Use `rem`, never fixed px for text. Sizes with `min-h-(--tap)` follow the mode. Primary actions are full-width buttons on mobile.
- Colour contrast ≥ 4.5:1 (7:1 in high-contrast mode). Never use colour alone for status — add an icon + text ("✓ Taken", "! Missed").
- Semantic landmarks, one `h1` per page, logical headings, visible `<label>` on every field, helpful error text linked with `aria-describedby`.
- Full keyboard use, visible focus ring, skip-to-content link, `aria-live="polite"` for results, toasts and AI output.
- Respect `prefers-reduced-motion` **and** the "Reduce motion" switch (both turn every animation off, in both modes). `<html lang="en">`.
- **Read-aloud** button (Web Speech `speechSynthesis`) on the Today view and AI output.
- Plain language: "Medicines", not "medication regimen". Times as "8:00 AM".

## 13. Code quality & efficiency

- Small single-purpose files (aim < 200 lines). Pure logic in `lib/domain`; I/O in `lib/data`; UI in `components`.
- Server Components by default; `"use client"` only where interaction needs it.
- Reads in Server Components call `lib/data` directly (no fetch to our own API). Mutations go through route handlers.
- Type everything; no `any`. Reuse types from `schemas.ts`.
- No new dependency without a one-line reason in the commit message.
- Use `Promise.all` for independent reads; avoid N+1 queries.

## 14. Testing rules

- Every feature ships with tests: pure logic, route handlers (mock `@/lib/data/*`, `@/lib/ai/gemini`, `@/lib/email/mailer`), and one interaction test.
- Default test environment is Node. Component test files start with `// @vitest-environment jsdom`.
- Query by role/label in UI tests (proves accessibility). No snapshots. No real network.
- Use fixtures from `src/test/fixtures.ts`.

## 15. Git

- Conventional commits: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`.
- **Never add `Co-Authored-By`, `Claude-Session`, or any AI attribution to commit messages.** (A commit-msg hook strips them anyway.)
- Commit only when `npm run typecheck` and `npm test` pass. Small commits, one feature slice each.
- Never commit `.env*` (except `.env.example`) or service-account files.

## 16. Working style (saves time and tokens)

- Plan first for each feature; follow `SPEC.md` order; tick checkboxes when done.
- Read only the files you need. Don't re-read files you just wrote. Summarise changes instead of pasting files.
- If the same fix fails twice, stop and explain the root cause and two options.
- If a request conflicts with this file or SPEC.md, say so before coding.

## 17. Definition of done (per feature)

Works end-to-end locally · zod validation + permission checks · tests added and passing ·
typecheck + lint clean · accessible (labels, focus, contrast, live regions) ·
activity log written for mutations · SPEC.md checkbox ticked · committed.
