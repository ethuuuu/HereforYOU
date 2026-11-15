"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Toast } from "@/components/ui/Toast";
import { sendJson } from "@/lib/api-client";
import { canEditMedicines, canSetMedsAuthorized } from "@/lib/auth/permissions";
import { ASSIGNABLE_ROLES, type Circle, type CircleRole, type Member } from "@/lib/domain/schemas";

const ROLE_LABELS: Record<CircleRole, string> = {
  elder: "Elder",
  organiser: "Organiser",
  caretaker: "Caretaker",
  doctor: "Doctor",
  family: "Family",
};

const ROLE_COLORS: Record<CircleRole, string> = {
  elder: "bg-primary text-on-primary",
  organiser: "bg-primary text-on-primary",
  caretaker: "border-2 border-primary text-primary bg-bg",
  doctor: "border-2 border-primary text-primary bg-bg",
  family: "border-2 border-line text-muted bg-bg",
};

function RoleBadge({ role }: { role: CircleRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-3 py-1 text-sm font-bold ${ROLE_COLORS[role]}`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

type Props = {
  circleId: string;
  members: Member[];
  myRole: CircleRole;
  myId: string;
  hasElder: boolean;
  owners: Pick<Circle, "createdBy" | "elderUid">;
};

export function MembersManager({ circleId, members: initial, myRole, myId, hasElder, owners }: Props) {
  const [members, setMembers] = useState(initial);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const canManage = myRole === "elder" || (myRole === "organiser" && !hasElder);

  async function changeRole(uid: string, role: CircleRole) {
    setBusy(uid);
    setToast(null);
    const res = await sendJson(`/api/circles/${circleId}/members/${uid}`, "PATCH", { role });
    setBusy(null);
    if (!res.ok) {
      setToast({ message: res.error, tone: "error" });
      return;
    }
    // Mirrors the server: becoming a doctor allows medicines; leaving doctor stops it (except the creator).
    const meds = (m: Member) =>
      role === "doctor" ? true : m.role === "doctor" && m.id !== owners.createdBy ? false : m.medsAuthorized;
    setMembers((prev) => prev.map((m) => (m.id === uid ? { ...m, role, medsAuthorized: meds(m) } : m)));
    setToast({ message: "Role updated.", tone: "success" });
  }

  async function setMeds(m: Member, allowed: boolean) {
    setBusy(m.id);
    setToast(null);
    const res = await sendJson(`/api/circles/${circleId}/members/${m.id}/medicines`, "PUT", { medsAuthorized: allowed });
    setBusy(null);
    if (!res.ok) {
      setToast({ message: res.error, tone: "error" });
      return;
    }
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, medsAuthorized: allowed } : x)));
    setToast({
      message: allowed ? `${m.name} can now add and edit medicines.` : `${m.name} can no longer add or edit medicines.`,
      tone: "success",
    });
  }

  async function removeMember(uid: string, name: string) {
    if (!confirm(`Remove ${name} from this circle? They can rejoin later with the passcode.`)) return;
    setBusy(uid);
    setToast(null);
    const res = await sendJson(`/api/circles/${circleId}/members/${uid}`, "DELETE");
    setBusy(null);
    if (!res.ok) {
      setToast({ message: res.error, tone: "error" });
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== uid));
    setToast({ message: `${name} removed from the circle.`, tone: "success" });
  }

  return (
    <div className="flex flex-col gap-6">
      <Toast message={toast?.message} tone={toast?.tone ?? "info"} />

      <ul className="flex flex-col gap-4" role="list" aria-label="Circle members">
        {members.map((m) => (
          <li key={m.id} className="rounded-lg border-2 border-line bg-surface px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xl font-bold">{m.name}</span>
                {m.email && <span className="text-muted">{m.email}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RoleBadge role={m.role} />
                {canEditMedicines(m) && (
                  <span className="inline-flex items-center rounded-md border-2 border-line bg-bg px-3 py-1 text-sm font-bold">
                    <span aria-hidden="true">✓&nbsp;</span>Can add medicines
                  </span>
                )}
              </div>
            </div>

            {m.role === "doctor" && <p className="mt-3 text-muted">Doctor — always allowed to add medicines.</p>}

            {canSetMedsAuthorized(owners, myId, m) && (
              <button
                type="button"
                role="switch"
                aria-checked={canEditMedicines(m)}
                aria-label={`Can add and edit medicines: ${m.name}`}
                disabled={busy === m.id}
                onClick={() => setMeds(m, !canEditMedicines(m))}
                className="mt-4 flex min-h-(--tap) w-full items-center justify-between gap-4 rounded-lg border-2 border-field bg-bg px-4 py-2 text-left text-base font-bold sm:w-auto"
              >
                <span>Can add and edit medicines</span>
                <span
                  aria-hidden="true"
                  className={`rounded-md px-3 py-1 text-sm ${canEditMedicines(m) ? "bg-primary text-on-primary" : "border-2 border-line text-muted"}`}
                >
                  {canEditMedicines(m) ? "On" : "Off"}
                </span>
              </button>
            )}

            {canManage && m.role !== "elder" && (
              <div className="mt-4 flex flex-wrap gap-3" role="group" aria-label={`Actions for ${m.name}`}>
                {/* Role selector */}
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-bold">Change role</span>
                  <select
                    className="min-h-(--tap) rounded-lg border-2 border-field bg-bg px-3 py-2 text-base"
                    value={m.role}
                    disabled={busy === m.id}
                    aria-label={`Role for ${m.name}`}
                    onChange={(e) => changeRole(m.id, e.target.value as CircleRole)}
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-end">
                  <Button
                    variant="danger"
                    loading={busy === m.id}
                    loadingText="Removing…"
                    onClick={() => removeMember(m.id, m.name)}
                    className="sm:w-auto"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Passcode rotation form — elder only once a circle is claimed. */
export function RotatePasscodeForm({ circleId }: { circleId: string }) {
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const passcode = String(f.get("passcode") ?? "");
    const confirm = String(f.get("confirm") ?? "");
    if (passcode !== confirm) {
      setToast({ message: "The two passcodes don't match.", tone: "error" });
      return;
    }
    setBusy(true);
    setToast(null);
    const res = await sendJson(`/api/circles/${circleId}/passcode`, "PUT", { passcode });
    setBusy(false);
    if (!res.ok) {
      setToast({ message: res.error, tone: "error" });
      return;
    }
    setToast({ message: "Passcode changed. Tell the new one to anyone who needs to join.", tone: "success" });
    (e.target as HTMLFormElement).reset();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field
        label="New passcode"
        hint="6 to 12 numbers."
        name="passcode"
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        required
      />
      <Field
        label="Type it again"
        name="confirm"
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        required
      />
      <Toast message={toast?.message} tone={toast?.tone ?? "info"} />
      <Button type="submit" variant="secondary" loading={busy} loadingText="Changing…">
        Change passcode
      </Button>
    </form>
  );
}
