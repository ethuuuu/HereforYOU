import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const generateContent = vi.fn();
const ctor = vi.fn();
vi.mock("@google/genai", async (orig) => ({
  ...(await orig<typeof import("@google/genai")>()),
  GoogleGenAI: class {
    models = { generateContent };
    constructor(opts: unknown) {
      ctor(opts);
    }
  },
}));
vi.mock("@/lib/env", () => ({
  serverEnv: () => ({ GEMINI_API_KEY: "test-key-123", GEMINI_MODEL: "m", GEMINI_TTS_MODEL: "tts", GEMINI_TTS_VOICE: "v" }),
}));

const { generateJSON, generateSpeech, toGeminiSchema } = await import("./gemini");
const Schema = z.object({ medications: z.array(z.object({ name: z.string() })), uncertain: z.array(z.string()) });
const reply = (text: string) => ({ text });

afterEach(() => generateContent.mockReset());

describe("toGeminiSchema", () => {
  it("turns a zod schema into a plain JSON Schema without the $schema marker", () => {
    const js = toGeminiSchema(Schema)!;
    expect(js.$schema).toBeUndefined();
    expect(js).toMatchObject({ type: "object", required: ["medications", "uncertain"] });
  });
});

describe("generateJSON", () => {
  it("uses the v1beta API and sends the JSON schema + minimal thinking", async () => {
    generateContent.mockResolvedValue(reply('{"medications":[{"name":"Metformin"}],"uncertain":[]}'));
    const out = await generateJSON(Schema, { system: "s", prompt: "p", minimalThinking: true });
    expect(out.medications[0].name).toBe("Metformin");
    expect(ctor).toHaveBeenCalledWith(expect.objectContaining({ apiVersion: "v1beta" }));
    const config = generateContent.mock.calls[0][0].config;
    expect(config.responseJsonSchema).toMatchObject({ type: "object" });
    expect(config.thinkingConfig).toEqual({ thinkingLevel: "MINIMAL" });
    expect(generateContent).toHaveBeenCalledTimes(1); // valid first time: no retry
  });

  it("retries once without the thinking setting if the model rejects it", async () => {
    generateContent
      .mockRejectedValueOnce(new Error("thinking_level is not supported for this model"))
      .mockResolvedValueOnce(reply('{"medications":[],"uncertain":[]}'));
    await generateJSON(Schema, { system: "s", prompt: "p", minimalThinking: true });
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent.mock.calls[1][0].config.thinkingConfig).toBeUndefined();
  });

  it("keeps zod validation with one corrective retry", async () => {
    generateContent.mockResolvedValueOnce(reply('{"medications":"nope"}')).mockResolvedValueOnce(reply('{"medications":[],"uncertain":["?"]}'));
    const out = await generateJSON(Schema, { system: "s", prompt: "p" });
    expect(out.uncertain).toEqual(["?"]);
    expect(generateContent.mock.calls[1][0].contents[0].parts.at(-1).text).toContain("previous answer was invalid");
  });
});

describe("generateSpeech", () => {
  it("asks for audio with the configured voice and wraps the PCM as WAV", async () => {
    generateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ inlineData: { data: Buffer.from([0, 0]).toString("base64"), mimeType: "audio/L16;rate=24000" } }] } }],
    });
    const wav = await generateSpeech("Hello");
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    const config = generateContent.mock.calls[0][0].config;
    expect(config.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe("v");
  });
});
