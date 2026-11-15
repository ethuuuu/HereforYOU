/**
 * Sends email through Gmail (dedicated app account + app password). Server-only.
 */
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { serverEnv } from "@/lib/env";
import type { EmailContent } from "./templates";

let transporter: Transporter | null = null;

function mailer() {
  if (transporter) return transporter;
  const env = serverEnv();
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
  });
  return transporter;
}

export async function sendEmail(to: string, content: EmailContent): Promise<void> {
  await mailer().sendMail({
    from: `"Here For YOU" <${serverEnv().GMAIL_USER}>`,
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}
