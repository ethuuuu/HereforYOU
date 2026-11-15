/**
 * The ONLY place the app talks to a language model: Google Gemini via @google/genai.
 * Server-only. Configure GEMINI_API_KEY and GEMINI_MODEL (copy the current Flash
 * model id from Google AI Studio).
 */
import "server-only";
import { GoogleGenAI, Modality, ThinkingLevel, type Content, type Part } from "@google/genai";
import { z } from "zod";
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
  /** JSON Schema the model must follow (Gemini structured output). */
  jsonSchema?: unknown;
  /** Skip "thinking" for simple extraction: much faster first token. */
  minimalThinking?: boolean;
};

let client: GoogleGenAI | null = null;
function gemini(): GoogleGenAI {
  // SDK v3 defaults to the stable "v1" API, which rejects speechConfig, responseJsonSchema and
  // thinkingConfig ("Unknown name … Cannot find field"). All three live in v1beta.
  client ??= new GoogleGenAI({ apiKey: serverEnv().GEMINI_API_KEY, apiVersion: "v1beta" });
  return client;
}

/** zod → JSON Schema for Gemini's responseJsonSchema, or undefined if the schema can't be expressed. */
export function toGeminiSchema(schema: z.ZodType): Record<string, unknown> | undefined {
  try {
    const js = z.toJSONSchema(schema, { unrepresentable: "any" }) as Record<string, unknown>;
    delete js.$schema; // Gemini's schema parser doesn't accept the meta-schema URL
    return js;
  } catch {
    return undefined;
  }
}

export async function generateText(opts: GenerateOptions): Promise<string> {
  const parts = [
    ...(opts.images ?? []).map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } })),
    { text: opts.prompt },
  ];
  const call = (thinking: boolean) =>
    gemini().models.generateContent({
      model: serverEnv().GEMINI_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: opts.system,
        maxOutputTokens: opts.maxOutputTokens ?? 1024,
        temperature: 0.2,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
        ...(opts.jsonSchema ? { responseJsonSchema: opts.jsonSchema } : {}),
        ...(thinking ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } } : {}),
      },
    });
  try {
    let res;
    try {
      res = await call(Boolean(opts.minimalThinking));
    } catch (err) {
      // Older models take a thinking budget instead of a level: retry once with the model's default.
      if (!opts.minimalThinking || !/thinking/i.test(String(err))) throw err;
      res = await call(false);
    }
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
export async function generateJSON<T>(schema: z.ZodType<T>, opts: Omit<GenerateOptions, "json" | "jsonSchema">): Promise<T> {
  const system = `${opts.system}\n\n${jsonInstruction(schema)}`;
  // Structured output: Gemini follows the schema, so the first answer is almost always valid.
  // zod still validates it, and one corrective retry remains as a fallback.
  const jsonSchema = toGeminiSchema(schema);
  const first = parseModelJSON(schema, await generateText({ ...opts, system, json: true, jsonSchema }));
  if (first.ok) return first.data;
  const retry = parseModelJSON(
    schema,
    await generateText({
      ...opts,
      system,
      json: true,
      jsonSchema,
      prompt: `${opts.prompt}\n\nYour previous answer was invalid: ${first.error}\nReturn corrected JSON only.`,
    }),
  );
  if (retry.ok) return retry.data;
  throw new AIError("The AI returned data in an unexpected shape. Please try again.");
}

/* ---------- Assistant: function calling + transcription ---------- */

export type ChatTurn = { role: "user" | "model"; text: string };
export type ToolCall = { name: string; args: Record<string, unknown> };
export type ToolDeclaration = { name: string; description: string; parametersJsonSchema?: unknown };

const textOf = (parts: Part[] = []) =>
  parts
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();

/**
 * One assistant turn with Gemini function calling. The model may call tools; `onToolCall` runs
 * each one and returns the result to send back, or `null` to stop (e.g. an action that needs the
 * person's confirmation first). The model never runs anything itself.
 */
export async function chatWithTools(opts: {
  system: string;
  history: ChatTurn[];
  tools: ToolDeclaration[];
  onToolCall: (call: ToolCall) => Promise<Record<string, unknown> | null>;
  maxRounds?: number;
}): Promise<{ text: string; stoppedAt?: ToolCall }> {
  const contents: Content[] = opts.history.map((t) => ({ role: t.role, parts: [{ text: t.text }] }));
  for (let round = 0; round < (opts.maxRounds ?? 4); round++) {
    let content: Content | undefined;
    try {
      const res = await gemini().models.generateContent({
        model: serverEnv().GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: opts.system,
          maxOutputTokens: 1024,
          temperature: 0.3,
          tools: opts.tools.length ? [{ functionDeclarations: opts.tools }] : undefined,
        },
      });
      content = res.candidates?.[0]?.content;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new AIError(`Gemini request failed: ${message}`);
    }
    const calls = (content?.parts ?? []).flatMap((p) => (p.functionCall?.name ? [p.functionCall] : []));
    if (!content || calls.length === 0) return { text: textOf(content?.parts) };
    contents.push(content); // keeps Gemini's thought signatures, which the next round needs
    const responses: Part[] = [];
    for (const fc of calls) {
      const call = { name: fc.name!, args: fc.args ?? {} };
      const output = await opts.onToolCall(call);
      if (output === null) return { text: textOf(content.parts), stoppedAt: call };
      responses.push({ functionResponse: { id: fc.id, name: call.name, response: output } });
    }
    contents.push({ role: "user", parts: responses });
  }
  return { text: "" };
}

/** Speech → text with Gemini (audio sent inline). Returns "" when nothing was said. */
export async function transcribeAudio(audio: { mimeType: string; base64: string }): Promise<string> {
  try {
    const res = await gemini().models.generateContent({
      model: serverEnv().GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: audio.mimeType, data: audio.base64 } },
            { text: "Write down exactly what the person says, in their language. Reply with the words only. If nobody speaks, reply with nothing." },
          ],
        },
      ],
      config: { maxOutputTokens: 400, temperature: 0 },
    });
    return textOf(res.candidates?.[0]?.content?.parts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AIError(`Gemini transcription failed: ${message}`);
  }
}
