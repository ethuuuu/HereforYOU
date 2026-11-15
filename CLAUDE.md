# CLAUDE.md

@AGENTS.md
@SPEC.md

## Claude Code specifics

- The problem statement and scoring are in `PROBLEM.md` — re-read it when deciding scope.
- Work one SPEC feature per session. Start in **plan mode**, get the plan approved, then build.
- Custom commands: `/feature` (build next SPEC item), `/checkpoint` (verify + commit), `/fix` (two-strike debugging), `/review` (independent review), `/ship` (final pass).
- Skills in `.claude/skills/` hold the detailed how-to for: Firestore data, passkeys, the reminder engine, Gemini features, tests, accessibility and the ship check. Load the matching skill before starting that kind of work.
- Subagent `reviewer` gives a read-only review of uncommitted changes.
- For library APIs use the installed types, `node_modules/next/dist/docs/`, or the `context7` MCP server — don't guess.
- You cannot read `.env.local` (denied in settings). Ask the user to check a value instead; `/api/health` shows which integrations are configured.
