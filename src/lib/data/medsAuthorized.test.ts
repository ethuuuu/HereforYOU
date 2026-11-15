/**
 * Who may add medicines: the flag written by createCircle / claimCircle / changeRole /
 * setMedsAuthorized. Firestore is a tiny in-memory stand-in keyed by document path.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { member } from "@/test/fixtures";

const docs = new Map<string, Record<string, unknown>>();
vi.mock("@/lib/firebase/admin", () => {
  let auto = 0;
  const ref = (path: string) => ({
    path,
    id: path.split("/").pop()!,
    collection: (name: string) => ({ doc: (id = `auto${++auto}`) => ref(`${path}/${name}/${id}`) }),
  });
  const root = ref("");
  type Ref = { path: string };
  const tx = {
    get: async (r: Ref) => ({ exists: docs.has(r.path), data: () => docs.get(r.path) }),
    create: (r: Ref, d: Record<string, unknown>) => void docs.set(r.path, d),
    set: (r: Ref, d: Record<string, unknown>) => void docs.set(r.path, { ...docs.get(r.path), ...d }),
    update: (r: Ref, d: Record<string, unknown>) => void docs.set(r.path, { ...docs.get(r.path), ...d }),
    delete: (r: Ref) => void docs.delete(r.path),
  };
  return { db: () => ({ collection: root.collection, runTransaction: async <T,>(fn: (t: typeof tx) => Promise<T>) => fn(tx) }) };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { arrayUnion: () => "union", arrayRemove: () => "remove", delete: () => undefined },
}));
vi.mock("./activity", () => ({ logActivityIn: vi.fn() }));

const { logActivityIn } = await import("./activity");
const { createCircle } = await import("./circles");
const { changeRole, setMedsAuthorized } = await import("./membership");

const C = "/circles/c1";
const put = (uid: string, m: Record<string, unknown>) => docs.set(`${C}/members/${uid}`, m);
const meds = (uid: string) => docs.get(`${C}/members/${uid}`)?.medsAuthorized;

function seed() {
  docs.set(C, { createdBy: "u-organiser", elderUid: "u-elder", active: true });
  put("u-organiser", { ...member("caretaker"), name: "Ravi", medsAuthorized: true }); // creator, now caretaker
  put("u-elder", { ...member("elder"), name: "Asha", medsAuthorized: true });
  put("u-caretaker", { ...member("caretaker"), name: "Priya", medsAuthorized: false });
  put("u-doctor", { ...member("doctor"), name: "Dr Rao", medsAuthorized: true });
}

afterEach(() => {
  docs.clear();
  vi.clearAllMocks();
});

describe("createCircle", () => {
  it("lets the creator add medicines", async () => {
    const { circleId } = await createCircle(
      { uid: "u1", email: "a@example.com" },
      { setupRole: "family", elderName: "Asha", timezone: "Asia/Kolkata", passcode: "482913", largeText: true },
      "Ravi",
    );
    expect(docs.get(`/circles/${circleId}/members/u1`)).toMatchObject({ role: "organiser", medsAuthorized: true });
  });
});

describe("changeRole", () => {
  it("makes a new doctor allowed automatically, and stops it when they stop being a doctor", async () => {
    seed();
    expect(await changeRole("c1", member("elder", { name: "Asha" }), "u-caretaker", "doctor")).toBe("ok");
    expect(meds("u-caretaker")).toBe(true);
    expect(await changeRole("c1", member("elder", { name: "Asha" }), "u-caretaker", "family")).toBe("ok");
    expect(meds("u-caretaker")).toBe(false);
  });
});

describe("setMedsAuthorized", () => {
  it("lets the creator allow someone, and logs it", async () => {
    seed();
    expect(await setMedsAuthorized("c1", { id: "u-organiser", name: "Ravi" }, "u-caretaker", true)).toBe("ok");
    expect(meds("u-caretaker")).toBe(true);
    expect(vi.mocked(logActivityIn).mock.calls[0][2]).toMatchObject({
      action: "member.meds_allowed",
      summary: "Ravi allowed Priya to add medicines",
    });
  });

  it("lets the elder stop someone, and logs it", async () => {
    seed();
    put("u-caretaker", { ...member("caretaker"), name: "Priya", medsAuthorized: true });
    expect(await setMedsAuthorized("c1", { id: "u-elder", name: "Asha" }, "u-caretaker", false)).toBe("ok");
    expect(meds("u-caretaker")).toBe(false);
    expect(vi.mocked(logActivityIn).mock.calls[0][2].summary).toBe("Asha stopped Priya adding medicines");
  });

  it("refuses anyone who isn't the creator or the elder", async () => {
    seed();
    put("u-other", { ...member("caretaker"), name: "Sam", medsAuthorized: true });
    expect(await setMedsAuthorized("c1", { id: "u-other", name: "Sam" }, "u-caretaker", true)).toBe("forbidden");
    expect(meds("u-caretaker")).toBe(false);
  });

  it("can't stop a doctor, the creator or the elder", async () => {
    seed();
    const asha = { id: "u-elder", name: "Asha" };
    expect(await setMedsAuthorized("c1", asha, "u-doctor", false)).toBe("forbidden");
    expect(await setMedsAuthorized("c1", asha, "u-organiser", false)).toBe("forbidden");
    expect(await setMedsAuthorized("c1", { id: "u-organiser", name: "Ravi" }, "u-elder", false)).toBe("forbidden");
    expect(logActivityIn).not.toHaveBeenCalled();
  });

  it("reports a missing member", async () => {
    seed();
    expect(await setMedsAuthorized("c1", { id: "u-elder", name: "Asha" }, "ghost", true)).toBe("not_found");
  });
});
