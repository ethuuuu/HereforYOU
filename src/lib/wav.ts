/**
 * Browser-safe WAV encoding for voice input. Chrome records WebM/Opus, which isn't on Gemini's
 * documented audio list; 16 kHz mono 16-bit WAV is, and is plenty for speech (~32 KB/second).
 */

export const SPEECH_RATE = 16_000;

/** Mono float samples (-1..1) → a 16-bit PCM WAV file. Pure; unit-tested. */
export function encodeWav(samples: Float32Array, sampleRate = SPEECH_RATE): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => {
    const clamped = Math.max(-1, Math.min(1, s));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  });
  return buffer;
}

/** Browser only: any recording the browser can decode → 16 kHz mono WAV. */
export async function recordingToWav(recording: Blob): Promise<Blob> {
  const decoded = await new AudioContext().decodeAudioData(await recording.arrayBuffer());
  const frames = Math.ceil(decoded.duration * SPEECH_RATE);
  const offline = new OfflineAudioContext(1, frames, SPEECH_RATE); // resamples and mixes to mono
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return new Blob([encodeWav(rendered.getChannelData(0))], { type: "audio/wav" });
}
