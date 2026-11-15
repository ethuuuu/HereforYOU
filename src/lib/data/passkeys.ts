import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";

/** passkeys/{credentialId} — top-level so sign-in can find a credential by its id alone. */
export type Passkey = {
  id: string;
  uid: string;
  publicKey: string; // base64url
  counter: number;
  transports: string[];
  deviceName: string;
  createdAt: string;
  lastUsedAt?: string;
};

const col = () => db().collection("passkeys");
const toPasskey = (d: DocumentSnapshot): Passkey => ({ id: d.id, ...(d.data() as Omit<Passkey, "id">) });

/** One passkey by credential id, or null. 1 read. */
export async function getPasskey(id: string): Promise<Passkey | null> {
  const snap = await col().doc(id).get();
  return snap.exists ? toPasskey(snap) : null;
}

/** Someone's passkeys, newest first. One query. */
export async function listPasskeys(uid: string): Promise<Passkey[]> {
  const snap = await col().where("uid", "==", uid).get();
  return snap.docs.map(toPasskey).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function savePasskey(passkey: Omit<Passkey, "createdAt" | "lastUsedAt">): Promise<void> {
  const { id, ...data } = passkey;
  await col().doc(id).create({ ...data, createdAt: new Date().toISOString() });
}

/** After a successful sign-in: store the new signature counter. */
export async function recordPasskeyUse(id: string, counter: number): Promise<void> {
  await col().doc(id).update({ counter, lastUsedAt: new Date().toISOString() });
}

/** Removes a passkey only if `uid` owns it. False if missing or someone else's. */
export async function deletePasskey(uid: string, id: string): Promise<boolean> {
  const ref = col().doc(id);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()?.uid !== uid) return false;
    tx.delete(ref);
    return true;
  });
}
