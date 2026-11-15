#!/usr/bin/env bash
# Here For YOU — one-time bootstrap. Run from the project folder AFTER pasting the kit in.
#   chmod +x bootstrap.sh && ./bootstrap.sh
# Scaffolds Next.js around the kit (never overwrites kit files), installs dependencies,
# sets git identity + the trailer-stripping hook, and verifies typecheck + tests.
set -euo pipefail

GIT_NAME="Ethan Joseph"
GIT_EMAIL="ethanjoseph5500@gmail.com"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [ -f package.json ]; then
  echo "package.json already exists — skipping Next.js scaffold."
else
  echo "→ Scaffolding Next.js (temporary folder, then merged in)…"
  TMP="$(mktemp -d)"
  npx -y create-next-app@latest "$TMP/app" --ts --tailwind --eslint --app --src-dir \
    --import-alias "@/*" --use-npm --skip-install --disable-git --yes >/dev/null
  # -n: never overwrite files that already exist (the kit always wins)
  cp -Rn "$TMP/app/." "$ROOT/"
  rm -rf "$TMP"
fi

echo "→ Installing dependencies…"
npm i firebase firebase-admin @google/genai @upstash/qstash nodemailer zod server-only \
  @simplewebauthn/server @simplewebauthn/browser
npm i -D @types/node@^22 @types/nodemailer vitest @vitest/coverage-v8 @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event

npm pkg set name="here-for-you" scripts.test="vitest run" scripts.typecheck="next typegen && tsc --noEmit" scripts.coverage="vitest run --coverage"

echo "→ Git…"
[ -d .git ] || git init -q -b main
git config user.name "$GIT_NAME"
git config user.email "$GIT_EMAIL"
git config core.hooksPath .githooks
chmod +x .githooks/commit-msg

# Make sure secrets can never be committed, but the template can
touch .gitignore
for line in ".env*" "!.env.example" "service-account*.json" ".vercel" "coverage"; do
  grep -qxF "$line" .gitignore || echo "$line" >> .gitignore
done
[ -f .env.local ] || cp .env.example .env.local

echo "→ Verifying…"
npm run typecheck
npm test

git add -A
git commit -qm "chore: scaffold Here For YOU base" || true

cat << 'NEXT'

✅ Base ready.
   1. Fill in .env.local (see README.md → "Keys")
   2. npm run dev  → open http://localhost:3000/api/health  (all integrations should be true)
   3. claude       → paste Prompt 0 from KICKOFF.md
NEXT
