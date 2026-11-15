/**
 * The ONLY place the app talks to a language model: Google Gemini via @google/genai.
 * Server-only. Configure GEMINI_API_KEY and GEMINI_MODEL (copy the current Flash
 * model id from Google AI Studio).
 */
import "server-only";
import { GoogleGenAI, Modality } from "@google/genai";
import type { z } from "zod";
import { pcmToWav, sampleRateOf } from "@/lib/audio";
import { serverEnv } from "@/lib/env";
import { jsonInstruction, parseModelJSON } from "./json";

export class AIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIError";
  }
}

export type ImageInput = { mimeType: "image/jpeg" | "image/png" | "image/webp"; base64: string };

type GenerateOptions = {
  system: string;
  prompt: string;
  images?: ImageInput[];
  maxOutputTokens?: number;
  json?: boolean;
};

let client: GoogleGenAI | null = null;
function gemini(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: serverEnv().GEMINI_API_KEY });
  return client;
}

export async function generateText(opts: GenerateOptions): Promise<string> {
  const parts = [
    ...(opts.images ?? []).map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } })),
    { text: opts.prompt },
  ];
  try {
    const res = await gemini().models.generateContent({
      model: serverEnv().GEMINI_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: opts.system,
        maxOutputTokens: opts.maxOutputTokens ?? 1024,
        temperature: 0.2,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    });
    return res.text ?? "";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AIError(`Gemini request failed: ${message}`);
  }
}

// Style direction for the voice; Gemini TTS speaks only the text after it.
const SPEECH_STYLE = "Read this aloud slowly, warmly and clearly, like a kind nurse talking to an older person:";

/** Natural-sounding speech for `text`, as a playable WAV file. */
export async function generateSpeech(text: string): Promise<Buffer> {
  const { GEMINI_TTS_MODEL, GEMINI_TTS_VOICE } = serverEnv();
  let audio: { data?: string; mimeType?: string } | undefined;
  try {
    const res = await gemini().models.generateContent({
      model: GEMINI_TTS_MODEL,
      contents: [{ role: "user", parts: [{ text: `${SPEECH_STYLE}\n\n${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_TTS_VOICE } } },
      },
    });
    audio = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AIError(`Gemini speech failed: ${message}`);
  }
  if (!audio?.data) throw new AIError("Gemini returned no audio.");
  return pcmToWav(Buffer.from(audio.data, "base64"), sampleRateOf(audio.mimeType));
}

/** Structured output validated with zod; retries once with the validation error. */
export async function generateJSON<T>(schema: z.ZodType<T>, opts: Omit<GenerateOptions, "json">): Promise<T> {
  const system = `${opts.system}\n\n${jsonInstruction(schema)}`;
  const first = parseModelJSON(schema, await generateText({ ...opts, system, json: true }));
  if (first.ok) return first.data;
  const retry = parseModelJSON(
    schema,
    await generateText({
      ...opts,
      system,
      json: true,
      prompt: `${opts.prompt}\n\nYour previous answer was invalid: ${first.error}\nReturn corrected JSON only.`,
    }),
  );
  if (retry.ok) return retry.data;
  throw new AIError("The AI returned data in an unexpected shape. Please try again.");
}
