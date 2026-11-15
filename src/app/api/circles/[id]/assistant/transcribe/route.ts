import { z } from "zod";
import { AIError, transcribeAudio } from "@/lib/ai/gemini";
import { enforceRateLimit } from "@/lib/data/rateLimits";
import { json, readJson, withCircle } from "@/lib/http";

export const maxDuration = 30;

// About a minute of speech as 16 kHz WAV (the browser converts to WAV); bounds cost and size.
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const AUDIO_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"] as const;

const AudioSchema = z.object({
  mimeType: z.enum(AUDIO_TYPES, "Use a WebM, Ogg, MP4, MP3 or WAV recording"),
  base64: z
    .string()
    .min(1)
    .max(Math.ceil(MAX_AUDIO_BYTES / 3) * 4, "The recording is too long. Please keep it under a minute.")
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "That recording could not be read"),
});

/** POST /api/circles/[id]/assistant/transcribe — a short voice recording → text, with Gemini. Nothing is stored. */
export async function POST(req: Request, ctx: RouteContext<"/api/circles/[id]/assistant/transcribe">) {
  const { id } = await ctx.params;
  return withCircle(req, id, "ai.use", async ({ member }) => {
    const audio = await readJson(req, AudioSchema);
    await enforceRateLimit(`ai-transcribe:${member.id}`, 60);
    try {
      return json({ text: await transcribeAudio(audio) });
    } catch (err) {
      if (!(err instanceof AIError)) throw err;
      console.warn("[assistant/transcribe] failed:", err.message.slice(0, 300));
      return json({ error: "We couldn't hear that just now. Please try again or type instead." }, 502);
    }
  });
}
