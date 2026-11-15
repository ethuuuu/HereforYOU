---
name: reminder-engine
description: Building and testing the email reminder runner for Here For YOU — the /api/reminders/run route, QStash and Vercel cron triggers, run-now for demos, idempotency with sentReminders, and notification preferences. Use this for any work on reminders, notifications, escalation, emails, QStash, cron, or the "Send reminders now" button.
---

# Reminder engine

## What already exists (don't rewrite)
- `planReminders()` in `src/lib/domain/reminders.ts` — decides what to send (escalation ladder, appointments, refills, dedupe via `alreadySent`). 15 tests.
- `renderReminder()` in `src/lib/email/templates.ts` — subject/text/html per action.
- `sendEmail()` in `src/lib/email/mailer.ts` — Gmail.
- `authorizeTrigger()` in `src/lib/auth/triggers.ts` — QStash signature or Vercel `CRON_SECRET`.

## Build `src/lib/reminders/runner.ts`
```ts
export async function runRemindersForCircle(circleId: string, now = new Date()): Promise<RunResult>
export async function runAllReminders(now = new Date()): Promise<RunResult>
```
For one circle:
1. Load in parallel: circle (timezone, elderName), members, active medications, logs for yesterday+today, appointments with `startsAt` in [now, now+26h], sentReminders keys with `sentAt` ≥ yesterday.
2. `today = localDateOf(now, tz)`; `doses = dosesForRange(meds, addDays(today,-1), today, tz)`.
3. `actions = planReminders({...})`.
4. For each action → `renderReminder(action, { elderName, timezone, appUrl })` → `sendEmail` to each recipient (`Promise.allSettled`) → if at least one succeeded, write `sentReminders/{action.key}` `{ kind, sentAt, recipientCount }`.
5. Return counts `{ sent, failed, actions }`. Never return email addresses.

## Route `src/app/api/reminders/run/route.ts`
- `export async function POST(req)` — QStash: `const body = await req.text(); const source = await authorizeTrigger(req, body)`.
- `export async function GET(req)` — Vercel cron (sends `Authorization: Bearer CRON_SECRET`).
- 401 if `source` is null. Set `export const maxDuration = 60` and `export const dynamic = "force-dynamic"`.
- `POST /api/circles/[id]/reminders/run-now` uses `withCircle(..., "medications.edit")` and `runRemindersForCircle`.

## QStash schedule (user does this in the Upstash console once deployed)
Schedules → Create → Destination `https://here-for-you.vercel.app/api/reminders/run`, method POST, cron `*/5 * * * *`. QStash signs each call; the route verifies it.

## Tests (`runner.test.ts`, `route.test.ts`)
Mock `@/lib/data/*` and `@/lib/email/mailer`. Cover: sends and records; skips keys already sent; a failing recipient doesn't block others; no recipients → nothing recorded; route returns 401 without valid trigger; run-now forbidden for `family`.
