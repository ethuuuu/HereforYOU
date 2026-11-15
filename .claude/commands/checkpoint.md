---
description: Verify and commit the current working state
---
Current changes:
!`git status --short`

Run `npm run typecheck`, `npm test` and `npm run lint`.
- All pass → `git add -A` and commit with one conventional commit message describing the change. No trailers of any kind (no Co-Authored-By, no Claude-Session).
- Anything fails → do NOT commit. Show the failing command and only the key error lines, then propose the fix.
