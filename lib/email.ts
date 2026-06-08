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
  to,
  replyTo,
  subject,
  text,
  html,
}: {
  to?: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const client = getResend();
  const from = process.env.EMAIL_FROM || "Legacy Training <onboarding@resend.dev>";
  const recipient = to || process.env.EMAIL_TO || "info@legacy-training.com";

  const { error } = await client.emails.send({
    from,
    to: recipient,
    replyTo,
    subject,
    text,
    ...(html ? { html } : {}),
  });

  if (error) throw error;
}
