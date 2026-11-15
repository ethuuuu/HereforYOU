import { z } from "zod";
import { AIError, generateSpeech } from "@/lib/ai/gemini";
import { requireUser } from "@/lib/auth/session";
import { handle, json, readJson } from "@/lib/http";

// Read-aloud text is short (a day's doses, AI suggestions); the cap bounds cost per call.
const SpeakSchema = z.object({ text: z.string().trim().min(1).max(1500) });

/** POST /api/tts — signed-in users only. Text → natural Gemini speech as WAV. Nothing is stored. */
export function POST(req: Request) {
  return handle(async () => {
    await requireUser();
    const { text } = await readJson(req, SpeakSchema);
    try {
      const wav = await generateSpeech(text);
      return new Response(new Uint8Array(wav), {
        headers: { "content-type": "audio/wav", "cache-control": "private, max-age=3600" },
      });
    } catch (err) {
      if (!(err instanceof AIError)) throw err;
      // Gemini's error (status/model), never the spoken text, which may contain health info.
      console.warn("[tts] speech failed:", err.message.slice(0, 300));
      return json({ error: "The voice isn't available right now." }, 502);
    }
  });
}
