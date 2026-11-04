import type { AppSettings } from './index.js';

/** Same shape as SmtpSettings of '@veit/auth-server/smtp' (structurally, so this package does not depend on it). */
export type AppSmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  url?: string;
  tlsRejectUnauthorized?: boolean;
};

/** Setting keys of the SMTP fields. url and tlsRejectUnauthorized are read only when named. */
export type SmtpSettingKeys = {
  host: string;
  port: string;
  secure: string;
  user: string;
  password: string;
  from: string;
  url?: string;
  tlsRejectUnauthorized?: string;
};

export const DEFAULT_SMTP_SETTING_KEYS: SmtpSettingKeys = {
  host: 'smtp_host',
  port: 'smtp_port',
  secure: 'smtp_secure',
  user: 'smtp_user',
  password: 'smtp_password',
  from: 'smtp_from',
};

/** Plenivo's keys. */
export const PLENIVO_SMTP_SETTING_KEYS: SmtpSettingKeys = {
  host: 'smtp_host',
  port: 'smtp_port',
  secure: 'smtp_secure',
  user: 'smtp_user',
  password: 'smtp_pass',
  from: 'mail_from',
  url: 'smtp_url',
  tlsRejectUnauthorized: 'smtp_tls_reject_unauthorized',
};

export type SmtpFromSettingsOptions = {
  /** Default DEFAULT_SMTP_SETTING_KEYS; partial keys are merged into it. */
  keys?: Partial<SmtpSettingKeys>;
  /** Sender when none is stored, e.g. 'Plenivo <noreply@localhost>'. */
  defaultFrom?: string;
  /** Default 587. */
  defaultPort?: number;
};

const TRUE = new Set(['1', 'true', 'yes', 'on']);
const FALSE = new Set(['0', 'false', 'no', 'off']);

/** The SMTP settings from stored values, or null when neither host nor url is set. */
export function smtpSettingsFromValues(
  values: Readonly<Record<string, string | null | undefined>>,
  options: SmtpFromSettingsOptions = {},
): AppSmtpSettings | null {
  const keys = { ...DEFAULT_SMTP_SETTING_KEYS, ...options.keys };
  const read = (key: string | undefined) => (key ? (values[key] ?? '').trim() : '');
  const host = read(keys.host);
  const url = read(keys.url);
  if (!host && !url) return null;
  const port = Number(read(keys.port));
  const tls = read(keys.tlsRejectUnauthorized).toLowerCase();
  const settings: AppSmtpSettings = {
    host,
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : (options.defaultPort ?? 587),
    secure: TRUE.has(read(keys.secure).toLowerCase()),
    user: read(keys.user),
    // Passwords keep their spaces.
    password: keys.password ? (values[keys.password] ?? '') : '',
    from: read(keys.from) || (options.defaultFrom ?? ''),
  };
  if (url) settings.url = url;
  if (FALSE.has(tls)) settings.tlsRejectUnauthorized = false;
  return settings;
}

/**
 * The settings getter that createSmtpMailer and createSmtpSender of '@veit/auth-server/smtp' take. The password key
 * should be one of the AppSettings' secretKeys; it is decrypted on every read.
 */
export function smtpSettingsFromAppSettings(
  settings: AppSettings,
  options: SmtpFromSettingsOptions = {},
): () => Promise<AppSmtpSettings | null> {
  const keys = { ...DEFAULT_SMTP_SETTING_KEYS, ...options.keys };
  const names = Object.values(keys).filter((k): k is string => typeof k === 'string' && k !== '');
  return async () => smtpSettingsFromValues(await settings.getMany(names), options);
}
