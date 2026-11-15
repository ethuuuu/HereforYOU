import { afterEach, describe, expect, it, vi } from "vitest";

// Tiny in-memory stand-in for the one Firestore collection this repository uses.
const docs = new Map<string, Record<string, unknown>>();
vi.mock("@/lib/firebase/admin", () => {
  const ref = (id: string) => ({ id });
  return {
    db: () => ({
      collection: () => ({ doc: (id = "auto1") => ({ ...ref(id), create: async (d: Record<string, unknown>) => void docs.set(id, d) }) }),
      runTransaction: async <T,>(fn: (tx: unknown) => Promise<T>) =>
        fn({
          get: async (r: { id: string }) => {
            const d = docs.get(r.id); // snapshot: copied at read time
            return { exists: Boolean(d), data: () => d };
          },
          delete: (r: { id: string }) => docs.delete(r.id),
        }),
    }),
  };
});

const { saveChallenge, takeChallenge } = await import("./webauthnChallenges");

afterEach(() => {
  docs.clear();
  vi.useRealTimers();
});

describe("webauthn challenges", () => {
  it("can be taken once, then is gone", async () => {
    const id = await saveChallenge({ challenge: "abc", purpose: "login" });
    expect(await takeChallenge(id, "login")).toEqual({ challenge: "abc", purpose: "login", uid: undefined, newUser: undefined });
    expect(await takeChallenge(id, "login")).toBeNull();
  });

  it("expires after 5 minutes (and is still deleted)", async () => {
    vi.useFakeTimers();
    const id = await saveChallenge({ challenge: "abc", purpose: "login" });
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(await takeChallenge(id, "login")).toBeNull();
    expect(docs.size).toBe(0);
  });

  it("can't be used for a different ceremony", async () => {
    const id = await saveChallenge({ challenge: "abc", purpose: "register", uid: "u1" });
    expect(await takeChallenge(id, "login")).toBeNull();
  });
});
