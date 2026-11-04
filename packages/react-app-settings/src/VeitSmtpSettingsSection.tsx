import { useState, type ReactNode } from 'react';
import { VeitAlert, VeitButton } from '@veit/react-controls';
import {
  VeitSettingsGroups,
  veitSettingText,
  type VeitSettingsField,
  type VeitSettingsGroup,
  type VeitSettingsGroupsProps,
  type VeitSettingsGroupsTexts,
  type VeitSettingsValues,
} from './VeitSettingsGroups.js';

/** Setting keys of the fields; the defaults match DEFAULT_SMTP_SETTING_KEYS of '@veit/app-settings/smtp'. */
export type VeitSmtpSettingKeys = {
  host: string;
  port: string;
  secure: string;
  user: string;
  password: string;
  from: string;
};

export const VEIT_SMTP_SETTING_KEYS: VeitSmtpSettingKeys = {
  host: 'smtp_host',
  port: 'smtp_port',
  secure: 'smtp_secure',
  user: 'smtp_user',
  password: 'smtp_password',
  from: 'smtp_from',
};

export type VeitSmtpSettingsTexts = VeitSettingsGroupsTexts & {
  title: string;
  description: string;
  host: string;
  port: string;
  secure: string;
  secureHint: string;
  user: string;
  password: string;
  from: string;
  fromHint: string;
  notConfigured: string;
  /** "{host}:{port}, from {from}" */
  summary: (s: { host: string; port: string; from: string }) => string;
  testMail: string;
  testMailSaveFirst: string;
  testMailSent: string;
};

export const veitSmtpSettingsTexts: Record<'de' | 'en', VeitSmtpSettingsTexts> = {
  de: {
    save: 'Speichern',
    cancel: 'Abbrechen',
    close: 'Schließen',
    show: 'Anzeigen',
    hide: 'Verbergen',
    copy: 'Kopieren',
    copied: 'Kopiert',
    secretStored: 'Gespeichert. Leer lassen, um es zu behalten.',
    loading: 'Lädt …',
    title: 'E-Mail-Versand',
    description: 'Über diesen Server gehen Bestätigungen, Anmeldecodes und Benachrichtigungen raus.',
    host: 'SMTP-Server',
    port: 'Port',
    secure: 'TLS von Anfang an',
    secureHint: 'Für Port 465. Aus: STARTTLS, wenn der Server es anbietet (Port 587).',
    user: 'Benutzer',
    password: 'Passwort',
    from: 'Absender',
    fromHint: 'Zum Beispiel: Name <noreply@example.org>',
    notConfigured: 'Nicht eingerichtet',
    summary: ({ host, port, from }) => `${host}:${port}${from ? `, Absender ${from}` : ''}`,
    testMail: 'Test-Mail senden',
    testMailSaveFirst: 'Erst speichern, dann testen.',
    testMailSent: 'Test-Mail ist raus.',
  },
  en: {
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    show: 'Show',
    hide: 'Hide',
    copy: 'Copy',
    copied: 'Copied',
    secretStored: 'Stored. Leave empty to keep it.',
    loading: 'Loading …',
    title: 'Email delivery',
    description: 'Confirmations, sign-in codes and notifications are sent through this server.',
    host: 'SMTP server',
    port: 'Port',
    secure: 'TLS from the start',
    secureHint: 'For port 465. Off: STARTTLS if the server offers it (port 587).',
    user: 'User',
    password: 'Password',
    from: 'Sender',
    fromHint: 'For example: Name <noreply@example.org>',
    notConfigured: 'Not set up',
    summary: ({ host, port, from }) => `${host}:${port}${from ? `, sender ${from}` : ''}`,
    testMail: 'Send a test mail',
    testMailSaveFirst: 'Save first, then test.',
    testMailSent: 'Test mail sent.',
  },
};

function TestMail({
  dirty,
  busy,
  onTestMail,
  texts,
  errorText,
}: {
  dirty: boolean;
  busy: boolean;
  onTestMail: () => Promise<unknown>;
  texts: VeitSmtpSettingsTexts;
  errorText: (error: unknown) => string;
}) {
  const [state, setState] = useState<{ kind: 'idle' | 'sending' } | { kind: 'sent' } | { kind: 'error'; text: string }>({ kind: 'idle' });
  const send = async () => {
    setState({ kind: 'sending' });
    try {
      await onTestMail();
      setState({ kind: 'sent' });
    } catch (error) {
      setState({ kind: 'error', text: errorText(error) });
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <div>
        <VeitButton variant="secondary" disabled={dirty || busy || state.kind === 'sending'} onClick={() => void send()}>
          {texts.testMail}
        </VeitButton>
      </div>
      {dirty && <p className="m-0 text-xs text-muted-foreground">{texts.testMailSaveFirst}</p>}
      {state.kind === 'sent' && <VeitAlert variant="success">{texts.testMailSent}</VeitAlert>}
      {state.kind === 'error' && <VeitAlert variant="error">{state.text}</VeitAlert>}
    </div>
  );
}

/** The SMTP group for VeitSettingsGroups, e.g. next to the host's own groups. */
export function veitSmtpSettingsGroup(
  texts: VeitSmtpSettingsTexts,
  options: {
    keys?: Partial<VeitSmtpSettingKeys>;
    /** More fields after the standard ones (Plenivo: smtp_url, smtp_tls_reject_unauthorized). */
    extraFields?: readonly VeitSettingsField[];
    /** Sends a test mail with the saved settings; adds the button. */
    onTestMail?: () => Promise<unknown>;
    errorText?: (error: unknown) => string;
    id?: string;
  } = {},
): VeitSettingsGroup {
  const k = { ...VEIT_SMTP_SETTING_KEYS, ...options.keys };
  const onTestMail = options.onTestMail;
  return {
    id: options.id ?? 'smtp',
    title: texts.title,
    description: texts.description,
    fields: [
      { key: k.host, label: texts.host, kind: 'text', placeholder: 'mail.example.org', autoComplete: 'off' },
      { key: k.port, label: texts.port, kind: 'number', placeholder: '587', min: 1, max: 65535 },
      { key: k.secure, label: texts.secure, kind: 'toggle', hint: texts.secureHint },
      { key: k.user, label: texts.user, kind: 'text', autoComplete: 'off' },
      { key: k.password, label: texts.password, kind: 'secret' },
      { key: k.from, label: texts.from, kind: 'text', hint: texts.fromHint },
      ...(options.extraFields ?? []),
    ],
    summary: (values: VeitSettingsValues) => {
      const host = veitSettingText(values, k.host);
      if (!host) return texts.notConfigured;
      return texts.summary({ host, port: veitSettingText(values, k.port) || '587', from: veitSettingText(values, k.from) });
    },
    extra: onTestMail
      ? ({ dirty, busy }) => (
          <TestMail dirty={dirty} busy={busy} onTestMail={onTestMail} texts={texts} errorText={options.errorText ?? String} />
        )
      : undefined,
  };
}

export type VeitSmtpSettingsSectionProps = Omit<VeitSettingsGroupsProps, 'groups' | 'texts' | 'title'> & {
  texts: VeitSmtpSettingsTexts;
  keys?: Partial<VeitSmtpSettingKeys>;
  extraFields?: readonly VeitSettingsField[];
  onTestMail?: () => Promise<unknown>;
  /** Card title; default none (the list item carries texts.title). */
  title?: ReactNode;
};

/**
 * SMTP settings: one list item with a summary, the popup edits host, port, TLS, user, password (masked, revealable
 * with onReveal) and sender. Pairs with '@veit/app-settings' and its smtpSettingsFromAppSettings.
 */
export function VeitSmtpSettingsSection({ texts, keys, extraFields, onTestMail, ...rest }: VeitSmtpSettingsSectionProps) {
  const group = veitSmtpSettingsGroup(texts, { keys, extraFields, onTestMail, errorText: rest.errorText });
  return <VeitSettingsGroups {...rest} texts={texts} groups={[group]} />;
}
