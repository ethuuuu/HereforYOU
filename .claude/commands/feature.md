---
description: Build the next SPEC.md feature (or a named one) as a tested vertical slice
argument-hint: "[feature id, e.g. F3]"
---
Build $ARGUMENTS — if empty, the first SPEC.md feature with unchecked boxes.

1. Load the matching skill(s) from `.claude/skills/` (passkeys → passkey-auth, data → firestore-data, reminders → reminder-engine, AI → gemini-feature, any UI → accessibility).
2. Restate the feature's "Done when" line, then list the files you will create/change. Wait for my OK if I'm in plan mode.
3. Build it as one vertical slice: UI → route (zod + `withCircle`/auth) → `lib/data` → activity log.
4. Write tests per the test-writer skill.
5. Run `npm run typecheck` and `npm test`; fix failures.
6. Tick the completed SPEC.md boxes.
7. Reply in ≤ 12 lines: what changed, how it was verified, how I can try it in the browser, anything left. Don't commit — I'll run /checkpoint.
