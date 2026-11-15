---
description: Two-strike debugging — root cause before code changes
argument-hint: "<what is wrong>"
---
Problem: $ARGUMENTS

1. Reproduce with the smallest command (test, typecheck, build, or a curl to the route) and quote only the key error lines.
2. State the root cause in 1–2 sentences with file:line.
3. Make the smallest fix for that root cause; re-run the same command.
4. Still failing → STOP. Don't try a third variant. Explain what you learned and give two different approaches for me to choose from (or `git checkout -- .` to revert).
