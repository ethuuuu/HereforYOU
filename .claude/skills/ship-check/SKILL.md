---
name: ship-check
description: Final pre-submission pass for Here For YOU — build health, security review, accessibility audit, efficiency, Google-services visibility, README and deploy smoke test, producing a pass/fail table. Use at feature freeze, before any production deploy, and whenever someone says ship, submit, final check or polish.
---

# Ship check
Fix small issues directly; list bigger ones as risks. No new features.

1. **Build health:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` — all pass.
2. **Security:** `git ls-files | grep -iE "env|service-account"` shows only `.env.example`; grep `src` for hard-coded keys (`AIza`, `-----BEGIN`, long hex); every `src/app/api/**/route.ts` validates with zod and authorises (`withCircle` or `authorizeTrigger`); no `dangerouslySetInnerHTML`; security headers present; errors generic.
3. **Accessibility:** apply the `accessibility` skill checklist to every page.
4. **Efficiency:** no needless `"use client"` pages; parallel reads; runner within read budget; AI outputs capped.
5. **Alignment:** walk the table in PROBLEM.md — every requirement demonstrably works.
6. **README.md:** title + pitch · live link · problem · features (map to requirements) · **Google services used** (Firebase Auth, Firestore, Gemini, Gmail, Calendar, Maps) · architecture diagram (text) · security & accessibility notes · setup (`./bootstrap.sh`, env vars) · tests (`npm test`, count) · limitations.
7. **Deploy:** Vercel env vars set, production `WEBAUTHN_RP_ID` + `APP_URL` correct, QStash schedule active, live demo script from SPEC.md passes.

Output: table of section → pass/fail → fixed / remaining.
