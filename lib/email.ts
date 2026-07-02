import { Resend } from "resend";

let resend: Resend | null = null;

function getResend() {
  if (!resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY not set");
    resend = new Resend(key);
  }
  return resend;
}

export async function sendEmail({
  subject,
  text,
  html,
}: {
  subject: string;
  text: string;
  html?: string;
}) {
  const client = getResend();

  // Fixed server-side, never caller-supplied (no open-relay risk).
  // Defaults keep the live form working with no env config; override in Vercel if addresses change.
  const from = process.env.EMAIL_FROM ?? "info@legacy-training.com";
  const recipient = process.env.EMAIL_TO ?? "info@legacy-training.com";

  const { error } = await client.emails.send({
    from,
    to: recipient,
    subject,
    text,
    ...(html ? { html } : {}),
  });

  if (error) throw error;
}
