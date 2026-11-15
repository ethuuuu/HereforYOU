/**
 * Pure helpers for turning model text into validated data (unit-tested).
 */
import { z } from "zod";

/** Pull the first JSON object/array out of model text (handles ```json fences and chatter). */
export function extractJSON(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new Error("No JSON found in model output");
  const open = cleaned[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
  }
  throw new Error("Unterminated JSON in model output");
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function parseModelJSON<T>(schema: z.ZodType<T>, text: string): ParseResult<T> {
  try {
    const result = schema.safeParse(extractJSON(text));
    if (result.success) return { ok: true, data: result.data };
    return { ok: false, error: z.prettifyError(result.error) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function jsonInstruction<T>(schema: z.ZodType<T>): string {
  return `Respond with ONLY a JSON value matching this JSON Schema. No prose, no markdown fences.\n${JSON.stringify(
    z.toJSONSchema(schema),
  )}`;
}

/** Wrap untrusted user text so the model treats it as data, not instructions. */
export function asUserData(label: string, text: string): string {
  const safe = text.replaceAll("</user_input>", "");
  return `<user_input label="${label}">\n${safe}\n</user_input>`;
}
