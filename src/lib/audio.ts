/**
 * Gemini speech comes back as raw 16-bit little-endian mono PCM ("audio/L16;rate=24000").
 * Browsers can't play that directly, so we wrap it in a 44-byte WAV header.
 */

/** Sample rate from a mime type like "audio/L16;codec=pcm;rate=24000" (Gemini's default is 24 kHz). */
export function sampleRateOf(mimeType: string | undefined): number {
  const rate = Number(/rate=(\d+)/.exec(mimeType ?? "")?.[1]);
  return rate > 0 ? rate : 24_000;
}

export function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1, bitsPerSample = 16): Buffer {
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28); // byte rate
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
