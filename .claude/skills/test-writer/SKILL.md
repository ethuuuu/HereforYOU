---
name: test-writer
description: Writing fast, meaningful Vitest + Testing Library tests for Here For YOU — pure logic, route handlers with data/AI/email mocked, and accessible interaction tests. Use after building any feature, before every commit, and whenever tests, coverage or the testing score come up.
---

# Test writer

Scope: the feature just built. Don't rewrite existing tests.

1. **Pure logic** (`src/lib/**`): happy path, an edge case, invalid input. Reuse `src/test/fixtures.ts`.
2. **Route handlers**: import `POST`/`GET`, call with `new Request("http://test/api/...", { method, body: JSON.stringify(...) })`. Mock:
   ```ts
   vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(async () => ({ uid: "u-elder" })) }));
   vi.mock("@/lib/data/members", () => ({ getMember: vi.fn() }));
   ```
   Cover 200, 400 (zod), 401 (no session), 403 (role), and the main side effect (data function called with the right args, activity logged).
3. **Interaction test** (one per feature): first line `// @vitest-environment jsdom`; find elements by role/label; use `@testing-library/user-event`.

Rules: no real network/Firebase/Gemini/Gmail; no snapshots; test names describe behaviour; run `npm test` and `npm run typecheck` before reporting. Report: tests added, what they cover, pass count.
