# KICKOFF — prompts to paste into Claude Code

How to use this file:
- Run `claude` in the project folder. Paste one prompt at a time.
- For each feature: **`/clear`** first (fresh context = better results, fewer tokens), then switch to
  **plan mode** (press **Shift+Tab** until it shows plan mode), paste the prompt, review the plan,
  approve, let it build.
- After each feature: try it in the browser → `/review` → fix blockers → `/checkpoint` → `git push`.
- If something breaks: `/fix <what you see>`.

---

## Prompt 0 — Orientation (no code)

```
Read CLAUDE.md, AGENTS.md, SPEC.md and PROBLEM.md fully, then skim src/lib (it is already built and tested — run `npm test` to confirm 61 passing).

Then reply with:
1. A 5-line summary of what we're building and how it's scored.
2. Anything in the docs that seems contradictory or risky for a one-day build.
3. The files you'll create for F0.
Don't write any code yet.
```

## Prompt 1 — F0 Foundation

```
/feature F0

Notes:
- Read node_modules/next/dist/docs for the App Router layout, metadata and route handler conventions in this Next.js version before writing them.
- Visual style: calm and warm — white background, deep blue primary (#0b5394), large rounded cards, generous spacing. Must pass the accessibility skill checklist.
- withCircle() in src/lib/http.ts must be fully tested (401/403/400/404/500 mapping).
```

## Prompt 2 — F1a Google sign-in

```
/feature F1a

Use the passkey-auth skill (sessions part). Google popup via src/lib/firebase/client.ts, POST /api/session uses createSession(). Create users/{uid} on first sign-in. Header shows the signed-in name and a Sign out button.
```

## Prompt 3 — F1b Passkeys (timebox 75 min)

```
/feature F1b

Load the passkey-auth skill and read the @simplewebauthn/server and /browser v14 type definitions in node_modules before writing any calls. Keep "Continue with Google" visible everywhere passkeys appear. If you hit a blocker you can't solve in two attempts, stop and tell me — we'll move to F2 and come back.
```

## Prompt 4 — F2 Role-based onboarding & care circles

```
/feature F2

This is the heart of "secure, passcode-based access" and "elder at the centre". Load firestore-data and accessibility skills.
- /welcome: four large cards for who is setting up (elder / family / caretaker / doctor), each leading to its own tailored steps as described in SPEC.md F2.
- Use CreateProfileSchema, JoinCircleSchema, hashPasscode, verifyPasscode, isLockedOut, generateCircleCode, canChangeRole — all already exist.
- Membership writes must be transactions (members + users.circleIds).
- Every mutation logs to activity in plain language.
```

## Prompt 5 — F3 Medicines, Today & adherence

```
/feature F3

Use dosesForDate, summarizeAdherence, adherenceStreak, daysOfSupplyLeft (already built). Every DoseLog stores localDate. The Today view is what the elder sees first: big cards, "I took it" / "Skip", clear states with icon + word, read-aloud button, next appointment slot (placeholder until F4).
```

## Prompt 6 — F4 Appointments

```
/feature F4

Server computes startsAt with zonedToUtc in the circle's timezone. Each appointment shows "Add to Google Calendar" (googleCalendarUrl) and "Directions" (googleMapsUrl). Fill the next-appointment card on Today.
```

## Prompt 7 — F5 Reminder emails

```
/feature F5

Load the reminder-engine skill. planReminders, renderReminder, sendEmail and authorizeTrigger already exist — build the data queries, runner, routes (GET for Vercel cron, POST for QStash), run-now route + button, and notification preference checkboxes per member. Respect the Firestore read budget in AGENTS.md §9.
```

## Prompt 8 — F6 Gemini features

```
/feature F6

Load the gemini-feature skill. Build prompts.ts (prescription draft + visit questions), the two AI routes, "Add from prescription" (paste text or upload a photo → editable drafts → save selected) and "Suggest questions for this visit". Nothing AI-generated is saved without the user confirming.
```

## Prompt 9 — F7 Role dashboards (as time allows)

```
/feature F7

Caretaker home across all their circles, doctor's printable report, family "Is Mum OK today?" card. Skip the stretch items unless everything else is done.
```

## Prompt 10 — Ship (start by 3:30)

```
/ship
```

---

## Useful one-liners during the day

```
/review
/checkpoint
/fix the Today page shows doses an hour early
Run the full test suite and give me the count and any failures only.
Explain in 5 lines how the reminder runner decides who gets an email.
```
