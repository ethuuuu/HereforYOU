import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { isLockedOut, nextFailedAttempts, verifyPasscode } from "@/lib/auth/passcode";
import { canChangeRole } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { defaultNotifyPrefs } from "@/lib/domain/reminders";
import type { Circle, CircleRole, JoinCircleInput, Member } from "@/lib/domain/schemas";
import { db } from "@/lib/firebase/admin";
import { logActivityIn } from "./activity";
import { circleIdForCode, circleRef, memberRef, userRef } from "./refs";

export type JoinResult = "ok" | "invalid" | "locked";

/**
 * Join with circle code + passcode. Wrong passcodes are counted in the same
 * transaction; after 5 the circle is locked for 15 minutes. New members are `family`.
 */
export async function joinCircle(
  user: SessionUser,
  input: JoinCircleInput,
): Promise<{ result: JoinResult; circleId?: string }> {
  const circleId = await circleIdForCode(input.circleCode);
  if (!circleId) return { result: "invalid" };

  const result = await db().runTransaction(async (tx): Promise<JoinResult> => {
    const [circleSnap, memberSnap] = await Promise.all([tx.get(circleRef(circleId)), tx.get(memberRef(circleId, user.uid))]);
    const c = circleSnap.data() as Omit<Circle, "id"> | undefined;
    if (!c?.active) return "invalid";
    const now = new Date();
    if (isLockedOut(c.failedAttempts, c.lastFailedAt ? new Date(c.lastFailedAt) : null, now)) return "locked";
    if (!(await verifyPasscode(input.passcode, c.passcodeHash))) {
      tx.update(circleRef(circleId), {
        failedAttempts: nextFailedAttempts(c.failedAttempts),
        lastFailedAt: now.toISOString(),
      });
      return "invalid";
    }
    if (c.failedAttempts > 0) tx.update(circleRef(circleId), { failedAttempts: 0, lastFailedAt: FieldValue.delete() });
    if (memberSnap.exists) return "ok"; // already in — nothing to add

    const member: Omit<Member, "id"> = {
      name: input.displayName,
      ...(user.email ? { email: user.email } : {}),
      role: "family",
      notify: defaultNotifyPrefs("family"),
      joinedAt: now.toISOString(),
    };
    tx.create(memberRef(circleId, user.uid), member);
    tx.set(userRef(user.uid), { setupRole: input.setupRole, circleIds: FieldValue.arrayUnion(circleId) }, { merge: true });
    logActivityIn(tx, circleId, {
      actorUid: user.uid,
      actorName: input.displayName,
      action: "member.joined",
      summary: `${input.displayName} joined the circle as family`,
    });
    return "ok";
  });

  return result === "ok" ? { result, circleId } : { result };
}

export type ManageResult = "ok" | "forbidden" | "not_found";

const ROLE_WORDS: Record<CircleRole, string> = {
  elder: "the elder",
  organiser: "an organiser",
  caretaker: "a caretaker",
  doctor: "a doctor",
  family: "family",
};

/** Change someone's role. Rules (elder in charge, nobody becomes or demotes the elder) live in canChangeRole. */
export async function changeRole(
  circleId: string,
  actor: Pick<Member, "id" | "name" | "role">,
  targetUid: string,
  next: CircleRole,
): Promise<ManageResult> {
  return db().runTransaction(async (tx): Promise<ManageResult> => {
    const [circleSnap, targetSnap] = await Promise.all([tx.get(circleRef(circleId)), tx.get(memberRef(circleId, targetUid))]);
    const target = targetSnap.data() as Omit<Member, "id"> | undefined;
    if (!target) return "not_found";
    const hasElder = Boolean((circleSnap.data() as Circle | undefined)?.elderUid);
    if (targetUid === actor.id || !canChangeRole(actor.role, target.role, next, hasElder)) return "forbidden";
    if (target.role === next) return "ok";
    tx.update(memberRef(circleId, targetUid), { role: next });
    logActivityIn(tx, circleId, {
      actorUid: actor.id,
      actorName: actor.name,
      action: "member.role_changed",
      summary: `${actor.name} made ${target.name} ${ROLE_WORDS[next]}`,
    });
    return "ok";
  });
}

/** Remove someone from the circle. Same rules as changing their role; the elder can't be removed. */
export async function removeMember(
  circleId: string,
  actor: Pick<Member, "id" | "name" | "role">,
  targetUid: string,
): Promise<ManageResult> {
  return db().runTransaction(async (tx): Promise<ManageResult> => {
    const [circleSnap, targetSnap] = await Promise.all([tx.get(circleRef(circleId)), tx.get(memberRef(circleId, targetUid))]);
    const target = targetSnap.data() as Omit<Member, "id"> | undefined;
    if (!target) return "not_found";
    const hasElder = Boolean((circleSnap.data() as Circle | undefined)?.elderUid);
    // "Could the actor change this person's role?" is exactly who may remove them.
    if (targetUid === actor.id || !canChangeRole(actor.role, target.role, "family", hasElder)) return "forbidden";
    tx.delete(memberRef(circleId, targetUid));
    tx.set(userRef(targetUid), { circleIds: FieldValue.arrayRemove(circleId) }, { merge: true });
    logActivityIn(tx, circleId, {
      actorUid: actor.id,
      actorName: actor.name,
      action: "member.removed",
      summary: `${actor.name} removed ${target.name} from the circle`,
    });
    return "ok";
  });
}
