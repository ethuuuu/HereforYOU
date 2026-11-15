import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import {
  generateCircleCode,
  generateClaimCode,
  hashPasscode,
  isLockedOut,
  nextFailedAttempts,
  verifyPasscode,
} from "@/lib/auth/passcode";
import type { SessionUser } from "@/lib/auth/session";
import { defaultNotifyPrefs } from "@/lib/domain/reminders";
import type { Circle, ClaimCircleInput, CreateProfileInput, Member } from "@/lib/domain/schemas";
import { db } from "@/lib/firebase/admin";
import { logActivityIn } from "./activity";
import { circleCodeRef, circleIdForCode, circleRef, memberRef, userRef } from "./refs";

const CLAIM_DAYS = 7;
const CODE_TRIES = 5;

export async function getCircle(circleId: string): Promise<Circle | null> {
  const snap = await circleRef(circleId).get();
  return snap.exists ? { id: snap.id, ...(snap.data() as Omit<Circle, "id">) } : null;
}

/** Every active circle — what the reminder runner walks. One query, 1 read per circle. */
export async function listActiveCircles(): Promise<Circle[]> {
  const snap = await db().collection("circles").where("active", "==", true).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Circle, "id">) }));
}

export type CreatedCircle ={ circleId: string; code: string; claimCode?: string };

/**
 * Creates the circle, reserves its code, adds the creator (elder, or organiser
 * until the elder claims it) and links it to their user — all in one transaction.
 */
export async function createCircle(user: SessionUser, input: CreateProfileInput, creatorName: string): Promise<CreatedCircle> {
  const isElder = input.setupRole === "elder";
  const claimCode = isElder ? undefined : generateClaimCode();
  const [passcodeHash, claimCodeHash] = await Promise.all([
    hashPasscode(input.passcode),
    claimCode ? hashPasscode(claimCode) : undefined,
  ]);
  const ref = db().collection("circles").doc();
  const now = new Date();
  const role = isElder ? "elder" : "organiser";
  const memberName = isElder ? input.elderName : creatorName;
  const email = isElder ? (user.email ?? input.elderEmail) : user.email;

  const code = await db().runTransaction(async (tx) => {
    let code = "";
    for (let i = 0; i < CODE_TRIES && !code; i++) {
      const candidate = generateCircleCode();
      if (!(await tx.get(circleCodeRef(candidate))).exists) code = candidate;
    }
    if (!code) throw new Error("Could not reserve a circle code");

    const circle: Omit<Circle, "id"> = {
      code,
      elderName: input.elderName,
      ...(input.elderEmail ? { elderEmail: input.elderEmail } : {}),
      timezone: input.timezone,
      passcodeHash,
      failedAttempts: 0,
      ...(isElder
        ? { elderUid: user.uid }
        : {
            organiserUid: user.uid,
            claimCodeHash,
            claimExpiresAt: new Date(now.getTime() + CLAIM_DAYS * 86_400_000).toISOString(),
          }),
      active: true,
      createdAt: now.toISOString(),
      createdBy: user.uid,
    };
    const member: Omit<Member, "id"> = {
      name: memberName,
      ...(email ? { email } : {}),
      role,
      notify: defaultNotifyPrefs(role),
      joinedAt: now.toISOString(),
    };
    tx.create(circleCodeRef(code), { circleId: ref.id });
    tx.create(ref, circle);
    tx.create(memberRef(ref.id, user.uid), member);
    tx.set(
      userRef(user.uid),
      {
        setupRole: input.setupRole,
        circleIds: FieldValue.arrayUnion(ref.id),
        ...(isElder ? { prefs: { largeText: input.largeText } } : {}),
      },
      { merge: true },
    );
    logActivityIn(tx, ref.id, {
      actorUid: user.uid,
      actorName: memberName,
      action: "circle.created",
      summary: isElder
        ? `${memberName} created this care circle`
        : `${memberName} set up this care circle for ${input.elderName}`,
    });
    return code;
  });

  return { circleId: ref.id, code, ...(claimCode ? { claimCode } : {}) };
}

export type ClaimResult = "ok" | "invalid" | "locked" | "already_claimed" | "is_organiser";

/**
 * The elder takes over a circle a relative set up. They become `elder`; the
 * organiser becomes `caretaker`. Wrong codes count towards the circle's lockout.
 */
export async function claimCircle(
  user: SessionUser,
  input: ClaimCircleInput,
): Promise<{ result: ClaimResult; circleId?: string }> {
  const circleId = await circleIdForCode(input.circleCode);
  if (!circleId) return { result: "invalid" };

  const result = await db().runTransaction(async (tx): Promise<ClaimResult> => {
    const snap = await tx.get(circleRef(circleId));
    const c = snap.data() as Omit<Circle, "id"> | undefined;
    if (!c?.active) return "invalid";
    if (c.elderUid) return "already_claimed";
    if (c.organiserUid === user.uid) return "is_organiser";
    const organiser = c.organiserUid ? (await tx.get(memberRef(circleId, c.organiserUid))).data() : undefined;

    const now = new Date();
    if (isLockedOut(c.failedAttempts, c.lastFailedAt ? new Date(c.lastFailedAt) : null, now)) return "locked";
    const live = c.claimCodeHash && c.claimExpiresAt && new Date(c.claimExpiresAt) > now;
    if (!live || !(await verifyPasscode(input.claimCode, c.claimCodeHash!))) {
      tx.update(circleRef(circleId), {
        failedAttempts: nextFailedAttempts(c.failedAttempts),
        lastFailedAt: now.toISOString(),
      });
      return "invalid";
    }

    tx.update(circleRef(circleId), {
      elderUid: user.uid,
      claimCodeHash: FieldValue.delete(),
      claimExpiresAt: FieldValue.delete(),
      failedAttempts: 0,
      lastFailedAt: FieldValue.delete(),
    });
    const elder: Omit<Member, "id"> = {
      name: c.elderName,
      ...(user.email ? { email: user.email } : {}),
      role: "elder",
      notify: defaultNotifyPrefs("elder"),
      joinedAt: now.toISOString(),
    };
    tx.set(memberRef(circleId, user.uid), elder);
    if (organiser) tx.update(memberRef(circleId, c.organiserUid!), { role: "caretaker" });
    tx.set(userRef(user.uid), { setupRole: "elder", circleIds: FieldValue.arrayUnion(circleId) }, { merge: true });
    logActivityIn(tx, circleId, {
      actorUid: user.uid,
      actorName: c.elderName,
      action: "circle.claimed",
      summary: organiser
        ? `${c.elderName} confirmed this is their care circle. ${organiser.name} is now a caretaker.`
        : `${c.elderName} confirmed this is their care circle.`,
    });
    return "ok";
  });

  return result === "ok" ? { result, circleId } : { result };
}

/** New passcode for joining. Resets the wrong-try count. Existing members are not affected. */
export async function rotatePasscode(circleId: string, actor: Pick<Member, "id" | "name">, passcode: string) {
  const passcodeHash = await hashPasscode(passcode);
  const batch = db().batch();
  batch.update(circleRef(circleId), { passcodeHash, failedAttempts: 0, lastFailedAt: FieldValue.delete() });
  logActivityIn(batch, circleId, {
    actorUid: actor.id,
    actorName: actor.name,
    action: "passcode.changed",
    summary: `${actor.name} changed the circle passcode`,
  });
  await batch.commit();
}
