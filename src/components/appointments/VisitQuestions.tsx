"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AI_NOTICE } from "@/components/medications/PrescriptionImport";
import { Button } from "@/components/ui/Button";
import { ReadAloud } from "@/components/ui/ReadAloud";
import { Toast } from "@/components/ui/Toast";
import { sendJson } from "@/lib/api-client";

type Suggestion = { text: string; keep: boolean };

/** "Suggest questions for this visit" → Gemini suggestions → the user ticks which to keep → saved only on "Save". */
export function VisitQuestions({ circleId, apptId, doctorName }: { circleId: string; apptId: string; doctorName: string }) {
  const router = useRouter();
  const url = `/api/circles/${circleId}/appointments/${apptId}/questions`;
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [busy, setBusy] = useState<"suggest" | "save" | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" } | null>(null);

  async function suggest() {
    setBusy("suggest");
    setMessage(null);
    const res = await sendJson<{ questions: string[] }>(url, "POST");
    setBusy(null);
    if (!res.ok) return setMessage({ text: res.error, tone: "error" });
    setSuggestions(res.data.questions.map((text) => ({ text, keep: true })));
  }

  async function save() {
    const questions = suggestions?.filter((s) => s.keep).map((s) => s.text) ?? [];
    setBusy("save");
    setMessage(null);
    const res = await sendJson(url, "PUT", { questions });
    setBusy(null);
    if (!res.ok) return setMessage({ text: res.error, tone: "error" });
    setSuggestions(null);
    setMessage({ text: `Saved ${questions.length} question${questions.length === 1 ? "" : "s"} for the visit.`, tone: "success" });
    router.refresh();
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <Button variant="secondary" onClick={suggest} loading={busy === "suggest"} loadingText="Thinking of questions…">
        {message?.tone === "error" && !suggestions ? "Try again" : "Suggest questions for this visit"}
        <span className="sr-only"> with {doctorName}</span>
      </Button>
      <div aria-live="polite" className="flex flex-col gap-3">
        {suggestions && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-lg font-bold">Suggested questions — untick any you don&apos;t want</legend>
            {suggestions.map((s, i) => (
              <label key={i} className="inline-flex min-h-12 items-start gap-3 text-lg">
                <input
                  type="checkbox"
                  className="mt-1 size-6 shrink-0"
                  checked={s.keep}
                  onChange={(e) => setSuggestions(suggestions.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))}
                />
                {s.text}
              </label>
            ))}
            <p className="font-bold">
              <span aria-hidden="true">i </span>
              {AI_NOTICE}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button onClick={save} loading={busy === "save"} loadingText="Saving…">
                Save these questions
              </Button>
              <ReadAloud text={`${suggestions.map((s) => s.text).join(" ")} ${AI_NOTICE}`} />
            </div>
          </fieldset>
        )}
      </div>
      <Toast message={message?.text} tone={message?.tone} />
    </div>
  );
}
