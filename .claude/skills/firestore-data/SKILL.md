---
name: firestore-data
description: How to read and write Here For YOU data in Cloud Firestore — repositories in src/lib/data, the collection layout, transactions for membership, activity logging and the free-plan read budget. Use this whenever you create or change anything in src/lib/data, add a collection or field, write a route that loads or saves circle data, or touch the reminder runner's queries.
---

# Firestore data

## Ground rules
- Server only: `import { db } from "@/lib/firebase/admin"`. Never use the Firestore client SDK in the browser (rules deny it).
- Layout and field names: AGENTS.md §7. Types: `src/lib/domain/schemas.ts`. Add new types there first.
- Timestamps are ISO strings (`new Date().toISOString()`); local dates/times are strings in the circle's timezone.

## Repository pattern (`src/lib/data/<collection>.ts`)
```ts
import "server-only";
import { db } from "@/lib/firebase/admin";
import type { Medication, MedicationInput } from "@/lib/domain/schemas";

const col = (circleId: string) => db().collection("circles").doc(circleId).collection("medications");

export async function listActiveMedications(circleId: string): Promise<Medication[]> {
  const snap = await col(circleId).where("active", "==", true).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Medication, "id">) }));
}
```
- Functions take/return plain typed objects; no `DocumentSnapshot` leaves this folder.
- Mock these modules in route tests: `vi.mock("@/lib/data/medications", () => ({ listActiveMedications: vi.fn() }))`.

## Must-use transactions
- Join / leave / role change: update `circles/{id}/members/{uid}` **and** `users/{uid}.circleIds` together.
- Passcode attempts: read `failedAttempts`/`lastFailedAt`, check `isLockedOut`, then increment or reset — in one transaction.
- Circle creation: reserve `circleCodes/{code}` with `create()` (fails if taken → generate again, max 5 tries).

## Activity log
Every mutation calls `logActivity(circleId, { actorUid, actorName, action, summary })` — summary is plain language: "Priya changed Metformin to 8:00 AM and 8:00 PM".

## Read budget (free plan: 50K reads/day)
- Reminder runner runs 288×/day — target < 30 reads per circle per run.
- Filter in the query (`where("active","==",true)`, date ranges on `startsAt`/`sentAt`), never fetch a whole subcollection to filter in JS.
- Today view: 1 read for the circle, 1 query for active meds, 1 query for logs `where("localDate", "==", today)` (every DoseLog stores `localDate`). Runner: `where("localDate", "in", [yesterday, today])`.
- Use `Promise.all` for independent queries.
- Composite indexes: if Firestore returns an index URL error, give the user the link to click.
