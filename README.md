# Here For YOU — base kit (start here)

Elder-centred healthcare companion: shared care circles with passcode access,
medicines + adherence, appointments, and email reminders that escalate to family and
caretakers. Built with Next.js on Vercel and Google's Firebase, Firestore and Gemini.

> This README is the setup guide. At ship time Claude Code rewrites it as the project README.

## What's already here

| Path | Purpose |
|---|---|
| `CLAUDE.md` → `AGENTS.md`, `SPEC.md` | Rules, architecture, data model and build plan Claude Code follows |
| `PROBLEM.md` | Problem statement + scoring + requirement map |
| `KICKOFF.md` | **The prompts to paste into Claude Code, in order** |
| `.claude/` | Settings (permissions, no AI commit attribution), 5 commands, 7 skills, reviewer subagent |
| `.githooks/commit-msg` | Strips Co-Authored-By / Claude-Session trailers from every commit |
| `src/lib/**` | Tested foundation: time zones, schedules, adherence, reminder planner, passcodes, permissions, Gemini, Gmail, Calendar links, sessions (61 tests) |
| `bootstrap.sh` | Scaffolds Next.js around the kit and installs everything |
| `vercel.json` · `firestore.rules` · `.env.example` · `.mcp.json` | Daily cron · deny-all client rules · every env var · Context7 docs for Claude Code |

## 1. Bootstrap (5 min)

```bash
# in your (empty or near-empty) project folder, with the kit pasted in:
chmod +x bootstrap.sh
./bootstrap.sh
```
It never overwrites kit files, and finishes by running typecheck + tests.

## 2. Keys (while bootstrap runs)

Put each value in `.env.local` (created by bootstrap from `.env.example`).

| Variable(s) | Where to get it |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase console → ⚙ Project settings → General → **Your apps → Add app → Web** (no hosting). Copy `apiKey`, `authDomain`, `projectId`, `appId`. |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Project settings → **Service accounts → Generate new private key** → then `base64 -i ~/Downloads/<file>.json \| tr -d '\n' \| pbcopy` and paste. Delete the JSON file afterwards. |
| *(Firestore)* | Build → **Firestore Database → Create database** → location `asia-south1` (Mumbai) → production mode. Then **Rules** tab → paste `firestore.rules` → Publish. |
| *(Google sign-in)* | Build → **Authentication → Get started → Sign-in method → Google → Enable**. Under **Settings → Authorized domains** add `here-for-you.vercel.app` (localhost is there already). |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | aistudio.google.com → **Get API key**. For the model, copy the current **Flash** model id shown in AI Studio. |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Create a new Gmail for the app → myaccount.google.com → Security → **2-Step Verification ON** → search **App passwords** → create "Here For YOU" → 16-character password (no spaces). |
| `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | console.upstash.com (no card) → **QStash** → copy both signing keys. |
| `CRON_SECRET` | `openssl rand -hex 24` |
| `APP_URL`, `WEBAUTHN_RP_ID` | Local: `http://localhost:3000` and `localhost`. Production: `https://here-for-you.vercel.app` and `here-for-you.vercel.app`. |

Check: `npm run dev` → http://localhost:3000/api/health → every integration `true`.

## 3. Build with Claude Code

```bash
claude
```
Open `KICKOFF.md` and paste **Prompt 0**, then one prompt per feature.
Rhythm per feature: `/clear` → plan mode (Shift+Tab) → prompt → approve → try it → `/review` → `/checkpoint` → `git push`.

## 4. Deploy (do it after F0, not at the end)

1. Push to GitHub → vercel.com → **Add New Project** → import the repo → name it **here-for-you** (this fixes the domain passkeys depend on — don't change it later).
2. Settings → **Environment Variables** → add everything from `.env.local`, with the **production** values for `APP_URL` and `WEBAUTHN_RP_ID`.
3. Redeploy → open `https://here-for-you.vercel.app/api/health`.
4. **QStash schedule** (after F5 is deployed): Upstash console → QStash → **Schedules → Create** → destination `https://here-for-you.vercel.app/api/reminders/run`, method **POST**, cron `*/5 * * * *`.
   Vercel's daily cron (`vercel.json`, 7:00 AM IST) is the safety net.

## 5. Daily rhythm reminders
- Commit after every working feature (`/checkpoint`), push often — Vercel redeploys automatically.
- Feature freeze at **3:30** → `/ship`. Submit as soon as the window opens.

## Troubleshooting
| Symptom | Fix |
|---|---|
| `Invalid or missing environment variables: X` | Add `X` to `.env.local` (and Vercel), restart `npm run dev`. |
| Firestore error with a link about an index | Click the link, create the index, wait ~1 min. |
| Google popup closes / `auth/unauthorized-domain` | Add the domain in Firebase Auth → Settings → Authorized domains. |
| Passkey works locally but not live | `WEBAUTHN_RP_ID` / `APP_URL` in Vercel must be the production domain; passkeys are per-domain — create a new one on the live site. |
| Emails not arriving | Check spam; confirm the app password (no spaces) and that 2-Step Verification is on for the sender account. |
| `/api/reminders/run` returns 401 | QStash signing keys missing in Vercel, or calling it by hand — use the "Send reminders now" button instead. |
