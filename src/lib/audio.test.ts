import { describe, expect, it } from "vitest";
import { pcmToWav, sampleRateOf } from "./audio";

describe("sampleRateOf", () => {
  it("reads the rate from Gemini's mime type, defaulting to 24 kHz", () => {
    expect(sampleRateOf("audio/L16;codec=pcm;rate=16000")).toBe(16000);
    expect(sampleRateOf("audio/L16")).toBe(24000);
    expect(sampleRateOf(undefined)).toBe(24000);
  });
});

describe("pcmToWav", () => {
  it("prepends a valid 44-byte mono 16-bit WAV header", () => {
    const pcm = Buffer.from([1, 2, 3, 4]);
    const wav = pcmToWav(pcm, 24000);
    expect(wav.length).toBe(48);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.readUInt32LE(4)).toBe(40);
    expect(wav.toString("ascii", 8, 16)).toBe("WAVEfmt ");
    expect(wav.readUInt16LE(22)).toBe(1); // mono
    expect(wav.readUInt32LE(24)).toBe(24000);
    expect(wav.readUInt32LE(28)).toBe(48000); // byte rate
    expect(wav.toString("ascii", 36, 40)).toBe("data");
    expect(wav.readUInt32LE(40)).toBe(4);
    expect(wav.subarray(44)).toEqual(pcm);
  });
});
