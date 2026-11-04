import nodemailer, { type Transporter } from 'nodemailer';
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
  /** Connection URL (smtp://user:pass@host:587); replaces host, port, secure, user and password when set. */
  url?: string;
  /** false accepts self-signed server certificates. Default true. */
  tlsRejectUnauthorized?: boolean;
};

/** Whether the settings are enough to send: a server (host or url) and a sender. */
export function smtpConfigured(s: SmtpSettings | null | undefined): s is SmtpSettings {
  return Boolean(s && (s.url || s.host) && s.from);
}

/** A nodemailer transport for the settings. */
export function createSmtpTransport(s: SmtpSettings): Transporter {
  if (s.url) return nodemailer.createTransport(s.url);
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: s.user ? { user: s.user, pass: s.password } : undefined,
    tls: s.tlsRejectUnauthorized === false ? { rejectUnauthorized: false } : undefined,
  });
}

export type SmtpMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Default: the sender of the settings. */
  from?: string;
  replyTo?: string;
};

export type SmtpSender = {
  /** Sends one mail; throws 'SMTP is not configured' when settings() gives nothing usable. */
  send(message: SmtpMessage): Promise<void>;
  /** Whether settings() currently gives something usable. */
  configured(): Promise<boolean>;
};

/**
 * Sends the host's own mails (invitations, notifications) through the same configuration as the account mails.
 * settings() is read for every mail; the transport is reused while the settings stay the same.
 */
export function createSmtpSender(settings: () => Promise<SmtpSettings | null>): SmtpSender {
  let cached: { fingerprint: string; transport: Transporter } | null = null;
  return {
    async send(message) {
      const s = await settings();
      if (!smtpConfigured(s)) throw new Error('SMTP is not configured');
      const fingerprint = JSON.stringify(s);
      if (cached?.fingerprint !== fingerprint) {
        cached?.transport.close();
        cached = { fingerprint, transport: createSmtpTransport(s) };
      }
      await cached.transport.sendMail({
        from: message.from ?? s.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        replyTo: message.replyTo,
      });
    },
    async configured() {
      return smtpConfigured(await settings());
    },
  };
}

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
  const sender = createSmtpSender(settings);
  const send = (to: string, subject: string, text: string) => sender.send({ to, subject, text });

  return {
    sendVerification: ({ to, url }) => send(to, texts.verifySubject, texts.verifyBody(url)),
    sendPasswordReset: ({ to, url }) => send(to, texts.resetSubject, texts.resetBody(url)),
    sendMfaLoginCode: ({ to, code }) => send(to, texts.mfaLoginSubject, texts.mfaLoginBody(code)),
    sendMfaSetupCode: ({ to, code }) => send(to, texts.mfaSetupSubject, texts.mfaSetupBody(code)),
  };
}
