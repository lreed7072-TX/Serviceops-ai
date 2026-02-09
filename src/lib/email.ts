import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || "");
  }
  return _resend;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const {
    to,
    subject,
    html,
    fromName = "ServiceOpsIQ",
    fromEmail = "noreply@serviceopsiq.com",
    replyTo,
  } = options;

  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  await getResend().emails.send({
    from,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
  });
}
