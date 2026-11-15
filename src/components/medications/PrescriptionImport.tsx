"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { ReadAloud } from "@/components/ui/ReadAloud";
import { Toast } from "@/components/ui/Toast";
import type { MedicationDraft, PrescriptionDraft } from "@/lib/ai/prompts";
import { sendJson } from "@/lib/api-client";
import { photoProblem, photoToUpload } from "@/lib/image";

export const AI_NOTICE = "Suggestion only — check with your doctor or pharmacist.";

const clock = (t: string) => new Date(`2000-01-01T${t}:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

type Draft = MedicationDraft & { key: number; selected: boolean };

/** Paste or photograph a prescription → Gemini drafts → the user edits, ticks and saves. Nothing saves without "Save". */
export function PrescriptionImport({ circleId, today }: { circleId: string; today: string }) {
  const router = useRouter();
  const textId = useId();
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [uncertain, setUncertain] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function read(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = String(f.get("text") ?? "").trim() || undefined;
    const file = f.get("photo");
    const photo = file instanceof File && file.size > 0 ? file : null;
    const problem = photo ? photoProblem(photo) : text ? null : "Paste the prescription or add a photo.";
    if (problem) return setError(problem);
    setReading(true);
    setError(null);
    try {
      const image = photo ? await photoToUpload(photo) : undefined;
      const res = await sendJson<{ draft: PrescriptionDraft }>(`/api/circles/${circleId}/ai/prescription`, "POST", { text, image });
      if (!res.ok) return setError(res.error);
      setDrafts(res.data.draft.medications.map((m, key) => ({ ...m, key, selected: true })));
      setUncertain(res.data.draft.uncertain);
    } catch {
      setError("We couldn't open that photo. Please try another one.");
    } finally {
      setReading(false);
    }
  }

  const edit = (key: number, patch: Partial<Draft>) =>
    setDrafts((ds) => ds?.map((d) => (d.key === key ? { ...d, ...patch } : d)) ?? null);

  async function save() {
    const chosen = drafts?.filter((d) => d.selected) ?? [];
    if (chosen.length === 0) return setError("Tick at least one medicine to save.");
    setSaving(true);
    setError(null);
    const failed: string[] = [];
    const saved = new Set<number>();
    for (const d of chosen) {
      const { name, dose, times, instructions, purpose } = d;
      const body = { name, dose, times, instructions: instructions || undefined, purpose: purpose || undefined, startDate: today };
      const res = await sendJson(`/api/circles/${circleId}/medications`, "POST", body);
      if (res.ok) saved.add(d.key);
      else failed.push(`${name || "A medicine"}: ${Object.values(res.fields)[0] ?? res.error}`);
    }
    setSaving(false);
    if (failed.length === 0) {
      router.push(`/c/${circleId}/medications`);
      router.refresh();
      return;
    }
    setDrafts((ds) => ds?.filter((d) => !saved.has(d.key)) ?? null); // never save the same medicine twice
    setError(`${saved.size ? `Saved ${saved.size}. ` : ""}Please fix and save again — ${failed.join("; ")}`);
  }

  const spoken = drafts?.length
    ? `I found: ${drafts.map((d) => `${d.name}, ${d.dose}, at ${d.times.map(clock).join(" and ")}`).join(". ")}. ${AI_NOTICE}`
    : "";

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={read} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={textId} className="text-lg font-bold">
            Paste the prescription text
          </label>
          <textarea id={textId} name="text" rows={6} maxLength={4000} className="rounded-lg border-2 border-field bg-bg px-4 py-2 text-lg" />
        </div>
        <Field label="Or add a photo of it" hint="JPEG, PNG or WebP, up to 4 MB." type="file" name="photo" accept="image/jpeg,image/png,image/webp" />
        <Button type="submit" loading={reading} loadingText="Reading your prescription…">
          {error && !drafts ? "Try again" : "Read my prescription"}
        </Button>
      </form>

      <Toast message={error} tone="error" />

      <section aria-live="polite" aria-labelledby={drafts ? "drafts-heading" : undefined} className="flex flex-col gap-4">
        {drafts && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 id="drafts-heading" className="text-2xl font-bold">
                Check these medicines
              </h3>
              {spoken && <ReadAloud text={spoken} />}
            </div>
            <p className="font-bold">
              <span aria-hidden="true">i </span>
              {AI_NOTICE} Nothing is saved until you press Save.
            </p>
            {uncertain.length > 0 && (
              <Card>
                <p className="text-lg font-bold">Please double-check:</p>
                <ul className="list-disc pl-6 text-lg">
                  {uncertain.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              </Card>
            )}
            {drafts.length === 0 && <p className="text-lg">No medicines found. Try a clearer photo or type the text.</p>}
            <ul className="flex flex-col gap-4" role="list">
              {drafts.map((d, i) => (
                <li key={d.key}>
                  <Card className="flex flex-col gap-4">
                    <label className="inline-flex min-h-(--tap) items-center gap-3 text-xl font-bold">
                      <input type="checkbox" className="size-6" checked={d.selected} onChange={(e) => edit(d.key, { selected: e.target.checked })} />
                      Save medicine {i + 1}
                    </label>
                    <Field label={`Medicine ${i + 1}: name`} value={d.name} onChange={(e) => edit(d.key, { name: e.target.value })} />
                    <Field label={`Medicine ${i + 1}: dose`} value={d.dose} onChange={(e) => edit(d.key, { dose: e.target.value })} />
                    {d.times.map((t, j) => (
                      <Field
                        key={j}
                        label={`Medicine ${i + 1}: time ${j + 1}`}
                        type="time"
                        value={t}
                        onChange={(e) => edit(d.key, { times: d.times.map((x, k) => (k === j ? e.target.value : x)) })}
                      />
                    ))}
                    <Field label={`Medicine ${i + 1}: how to take it`} value={d.instructions ?? ""} onChange={(e) => edit(d.key, { instructions: e.target.value })} />
                    <Field label={`Medicine ${i + 1}: what it is for`} value={d.purpose ?? ""} onChange={(e) => edit(d.key, { purpose: e.target.value })} />
                  </Card>
                </li>
              ))}
            </ul>
            {drafts.length > 0 && (
              <Button onClick={save} loading={saving} loadingText="Saving…">
                Save selected medicines
              </Button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
