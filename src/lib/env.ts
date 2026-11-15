/**
 * Server environment, validated once on first use. Import `serverEnv()` only in
 * server code. Missing values fail loudly with the variable name — never the value.
 */
import "server-only";
import { z } from "zod";

const ServerEnvSchema = z.object({
  APP_URL: z.url(),
  FIREBASE_SERVICE_ACCOUNT_BASE64: z.string().min(100),
  GEMINI_API_KEY: z.string().min(10),
  GEMINI_MODEL: z.string().min(3),
  GMAIL_USER: z.email(),
  GMAIL_APP_PASSWORD: z.string().min(16),
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(10),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(10),
  CRON_SECRET: z.string().min(16),
  WEBAUTHN_RP_ID: z.string().min(3), // e.g. here-for-you.vercel.app (no protocol)
  WEBAUTHN_RP_NAME: z.string().default("Here For YOU"),
});
export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const result = ServerEnvSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${missing}`);
  }
  cached = result.data;
  return cached;
}

/** Which integrations are configured — booleans only, safe to expose in /api/health. */
export function integrationStatus() {
  const has = (k: string) => Boolean(process.env[k]);
  return {
    firebase: has("FIREBASE_SERVICE_ACCOUNT_BASE64") && has("NEXT_PUBLIC_FIREBASE_API_KEY"),
    gemini: has("GEMINI_API_KEY") && has("GEMINI_MODEL"),
    gmail: has("GMAIL_USER") && has("GMAIL_APP_PASSWORD"),
    qstash: has("QSTASH_CURRENT_SIGNING_KEY") && has("QSTASH_NEXT_SIGNING_KEY"),
    cron: has("CRON_SECRET"),
    passkeys: has("WEBAUTHN_RP_ID") && has("APP_URL"),
  };
}
