"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AI_NOTICE } from "@/components/medications/PrescriptionImport";
import { Button } from "@/components/ui/Button";
import { ReadAloud } from "@/components/ui/ReadAloud";
import { Toast } from "@/components/ui/Toast";
import { sendJson } from "@/lib/api-client";

type Turn = { role: "user" | "model"; text: string; link?: { href: string; label: string }; result?: boolean };
type Pending = { tool: string; args: Record<string, unknown>; summary: string };
type Reply = { reply: string; pending?: Pending };

const HISTORY = 12; // the route accepts at most 12 turns
// Gemini reads these; the first the browser can record is used.
const RECORD_TYPES = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Chat with the Gemini assistant by typing or speaking. Actions it suggests run only after "Yes, do it". */
export function AssistantChat({ circleId }: { circleId: string }) {
  const inputId = useId();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState<"thinking" | "listening" | "transcribing" | "doing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const url = `/api/circles/${circleId}/assistant`;

  useEffect(() => () => recorder.current?.stream.getTracks().forEach((t) => t.stop()), []);

  async function send(message: string) {
    const words = message.trim();
    if (!words || busy) return;
    const next: Turn[] = [...turns, { role: "user", text: words }];
    setTurns(next);
    setText("");
    setPending(null);
    setError(null);
    setBusy("thinking");
    const res = await sendJson<Reply>(url, "POST", {
      messages: next.slice(-HISTORY).map(({ role, text }) => ({ role, text: text.slice(0, 2000) })),
    });
    setBusy(null);
    if (!res.ok) return setError(res.error);
    if (res.data.reply) setTurns((t) => [...t, { role: "model", text: res.data.reply }]);
    setPending(res.data.pending ?? null);
  }

  async function confirm() {
    if (!pending) return;
    setBusy("doing");
    setError(null);
    const res = await sendJson<{ reply: string; link?: Turn["link"] }>(url, "POST", { confirm: { tool: pending.tool, args: pending.args } });
    setBusy(null);
    if (!res.ok) return setError(res.error);
    setPending(null);
    setTurns((t) => [...t, { role: "model", text: res.data.reply, link: res.data.link, result: true }]);
  }

  function decline() {
    setPending(null);
    setTurns((t) => [...t, { role: "model", text: "Okay, I won't do that.", result: true }]);
  }

  async function startListening() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = RECORD_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setBusy("transcribing");
        const blob = new Blob(chunks, { type: rec.mimeType });
        const res = await sendJson<{ text: string }>(`${url}/transcribe`, "POST", {
          mimeType: rec.mimeType.split(";")[0],
          base64: await toBase64(blob),
        });
        setBusy(null);
        if (!res.ok) return setError(res.error);
        if (!res.data.text) return setError("I didn't hear anything. Please try again.");
        await send(res.data.text);
      };
      recorder.current = rec;
      rec.start();
      setBusy("listening");
    } catch {
      setError("The microphone isn't available. Please allow it in your browser, or type instead.");
    }
  }

  function stopListening() {
    recorder.current?.stop();
    recorder.current = null;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void send(text);
  }

  const status =
    busy === "thinking" ? "The assistant is thinking…" : busy === "transcribing" ? "Writing down what you said…" : busy === "doing" ? "Doing it now…" : null;

  return (
    <div className="flex flex-col gap-6">
      <ol role="log" aria-live="polite" aria-label="Conversation" className="flex flex-col gap-4">
        {turns.length === 0 && (
          <li className="glass rounded-lg p-5 text-lg text-muted">
            Try: “What do I take today?”, “I took my morning tablets”, “Add a visit with Dr Rao next Monday at 10” or “Email Priya
            that I’m feeling well”.
          </li>
        )}
        {turns.map((t, i) => (
          <li key={i} className={`flex flex-col gap-2 rounded-lg p-5 text-lg ${t.role === "user" ? "self-end bg-warm" : "glass"}`}>
            <p className="font-bold text-muted">{t.role === "user" ? "You" : "Assistant"}</p>
            <p className="whitespace-pre-line">{t.text}</p>
            {t.link && (
              <a href={t.link.href} target="_blank" rel="noopener noreferrer" className="font-bold">
                {t.link.label} <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
            {t.role === "model" && (
              <>
                {!t.result && <p className="text-muted">{AI_NOTICE}</p>}
                <ReadAloud text={t.text} label="Read this aloud" />
              </>
            )}
          </li>
        ))}
      </ol>

      {pending && (
        <section aria-labelledby="confirm-heading" className="glass flex flex-col gap-4 rounded-lg border-2 border-primary p-5">
          <h2 id="confirm-heading" className="text-2xl font-bold">
            Shall I do this?
          </h2>
          <p className="text-lg whitespace-pre-line">{pending.summary}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={confirm} loading={busy === "doing"} loadingText="Doing it…">
              <span aria-hidden="true">✓</span> Yes, do it
            </Button>
            <Button variant="secondary" onClick={decline} disabled={busy === "doing"}>
              <span aria-hidden="true">✕</span> No
            </Button>
          </div>
        </section>
      )}

      <Toast message={error ?? status} tone={error ? "error" : "info"} />

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor={inputId} className="text-lg font-bold">
          Type your message
        </label>
        <textarea
          id={inputId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          rows={2}
          className="min-h-(--tap) rounded-lg border-2 border-field bg-bg px-4 py-2 text-lg"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" disabled={Boolean(busy) || !text.trim()}>
            Send
          </Button>
          {busy === "listening" ? (
            <Button variant="danger" onClick={stopListening}>
              <span aria-hidden="true">■</span> Stop and send
            </Button>
          ) : (
            <Button variant="secondary" onClick={startListening} disabled={Boolean(busy)}>
              <span aria-hidden="true">🎤</span> Speak
            </Button>
          )}
        </div>
        {busy === "listening" && <p className="font-bold text-primary">Listening… press “Stop and send” when you finish.</p>}
      </form>
    </div>
  );
}
