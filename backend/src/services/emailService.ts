import nodemailer, { Transporter } from 'nodemailer';

// Outgoing email over SMTP. Configure with SMTP_HOST, SMTP_PORT,
// SMTP_SECURE (true for port 465), SMTP_USER, SMTP_PASS and MAIL_FROM. With
// no SMTP_HOST the app does not pretend to send: sendMail returns
// 'not_configured' and callers record that.

export interface MailMessage {
  to: string[];
  subject: string;
  text: string;
  html: string;
}

export type MailResult = { status: 'sent' } | { status: 'not_configured' } | { status: 'failed'; error: string };

type SendFn = (message: MailMessage & { from: string }) => Promise<void>;

let testSender: SendFn | null = null;
let cached: Transporter | null = null;

export function setMailSenderForTests(sender: SendFn | null): void {
  testSender = sender;
}

export function isEmailConfigured(): boolean {
  return !!testSender || (!!process.env.SMTP_HOST && !!process.env.MAIL_FROM);
}

function transporter(): Transporter {
  if (!cached) {
    cached = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return cached;
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  if (!isEmailConfigured()) return { status: 'not_configured' };
  if (message.to.length === 0) return { status: 'failed', error: 'No recipients' };
  const from = process.env.MAIL_FROM || 'cargoflow@localhost';
  try {
    if (testSender) await testSender({ ...message, from });
    else await transporter().sendMail({ from, to: message.to.join(', '), subject: message.subject, text: message.text, html: message.html });
    return { status: 'sent' };
  } catch (err) {
    return { status: 'failed', error: (err as Error).message };
  }
}
