import nodemailer from 'nodemailer';
import type { AuthMailer } from './types.js';

export type SmtpSettings = {
  host: string;
  port: number;
  /** true: TLS from the start (465); false: STARTTLS if offered (587). */
  secure: boolean;
  user: string;
  password: string;
  /** Sender, e.g. 'Hochwasserdienst <noreply@example.org>'. */
  from: string;
};

export type MailTexts = {
  appName: string;
  verifySubject: string;
  verifyBody: (url: string) => string;
  resetSubject: string;
  resetBody: (url: string) => string;
  mfaLoginSubject: string;
  mfaLoginBody: (code: string) => string;
  mfaSetupSubject: string;
  mfaSetupBody: (code: string) => string;
};

export function germanMailTexts(appName: string): MailTexts {
  return {
    appName,
    verifySubject: `${appName}: E-Mail-Adresse bestätigen`,
    verifyBody: (url) =>
      `Hallo,\n\nbitte bestätige deine E-Mail-Adresse für ${appName} über diesen Link:\n\n${url}\n\n` +
      `Der Link ist 24 Stunden gültig. Wenn du dich nicht registriert hast, kannst du diese Nachricht ignorieren.\n`,
    resetSubject: `${appName}: Passwort zurücksetzen`,
    resetBody: (url) =>
      `Hallo,\n\nüber diesen Link setzt du ein neues Passwort für ${appName}:\n\n${url}\n\n` +
      `Der Link ist eine Stunde gültig. Wenn du das nicht angefordert hast, ändert sich nichts.\n`,
    mfaLoginSubject: `${appName}: Anmeldecode`,
    mfaLoginBody: (code) => `Dein Anmeldecode für ${appName}: ${code}\n\nEr ist fünf Minuten gültig.\n`,
    mfaSetupSubject: `${appName}: Code für die Zwei-Faktor-Anmeldung`,
    mfaSetupBody: (code) =>
      `Mit diesem Code schaltest du die Anmeldung per E-Mail-Code für ${appName} ein: ${code}\n\nEr ist 15 Minuten gültig.\n`,
  };
}

/**
 * AuthMailer over SMTP. settings() is read for every mail, so changes in the host's settings apply without a restart;
 * it throws (or returns null) when SMTP is not configured.
 */
export function createSmtpMailer(settings: () => Promise<SmtpSettings | null>, texts: MailTexts): AuthMailer {
  async function send(to: string, subject: string, text: string): Promise<void> {
    const s = await settings();
    if (!s || !s.host || !s.from) throw new Error('SMTP is not configured');
    const transport = nodemailer.createTransport({
      host: s.host,
      port: s.port,
      secure: s.secure,
      auth: s.user ? { user: s.user, pass: s.password } : undefined,
    });
    await transport.sendMail({ from: s.from, to, subject, text });
  }

  return {
    sendVerification: ({ to, url }) => send(to, texts.verifySubject, texts.verifyBody(url)),
    sendPasswordReset: ({ to, url }) => send(to, texts.resetSubject, texts.resetBody(url)),
    sendMfaLoginCode: ({ to, code }) => send(to, texts.mfaLoginSubject, texts.mfaLoginBody(code)),
    sendMfaSetupCode: ({ to, code }) => send(to, texts.mfaSetupSubject, texts.mfaSetupBody(code)),
  };
}
