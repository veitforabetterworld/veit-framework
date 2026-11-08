import { VeitAccountSection } from '@veit/react-account';
import { VEIT_SETTINGS_ACTIONS, VeitAlert, VeitButton, VeitSettingsToggleRow, useVeitToastOptional } from '@veit/react-controls';
import type { VeitWebPushClient } from './client.js';
import { useVeitWebPush } from './useVeitWebPush.js';

export type VeitWebPushTexts = {
  title: string;
  description: string;
  /** Switch for all devices of the account. */
  enabled: string;
  enabledHint: string;
  /** Switch for this browser or device. */
  thisDevice: string;
  thisDeviceHint: string;
  test: string;
  testSent: string;
  /** "{n} devices" */
  devices: (n: number) => string;
  loading: string;
  notConfigured: string;
  unsupported: string;
  insecure: string;
  iosInstall: string;
  denied: string;
  failed: string;
};

export const veitWebPushTexts: Record<'de' | 'en', VeitWebPushTexts> = {
  de: {
    title: 'Benachrichtigungen',
    description: 'Push-Nachrichten im Browser, in der installierten App und auf Android. Jedes Gerät meldest du einzeln an.',
    enabled: 'Benachrichtigungen erhalten',
    enabledHint: 'Gilt für alle angemeldeten Geräte dieses Kontos.',
    thisDevice: 'Auf diesem Gerät',
    thisDeviceHint: 'Der Browser fragt beim Einschalten nach der Erlaubnis.',
    test: 'Test-Benachrichtigung senden',
    testSent: 'Test-Benachrichtigung gesendet.',
    devices: (n) => (n === 1 ? '1 Gerät angemeldet' : `${n} Geräte angemeldet`),
    loading: '…',
    notConfigured: 'Auf dem Server sind keine VAPID-Schlüssel eingerichtet, Push ist aus.',
    unsupported: 'Dieser Browser kann keine Push-Nachrichten empfangen.',
    insecure: 'Push geht nur über HTTPS.',
    iosInstall: 'Auf iPhone und iPad zuerst „Zum Home-Bildschirm“ wählen und die App von dort öffnen.',
    denied: 'Benachrichtigungen sind für diese Seite blockiert. Erlaube sie in den Website-Einstellungen des Browsers.',
    failed: 'Das hat nicht geklappt.',
  },
  en: {
    title: 'Notifications',
    description: 'Push messages in the browser, in the installed app and on Android. Each device is signed up separately.',
    enabled: 'Receive notifications',
    enabledHint: 'Applies to every signed-up device of this account.',
    thisDevice: 'On this device',
    thisDeviceHint: 'The browser asks for permission when you switch it on.',
    test: 'Send test notification',
    testSent: 'Test notification sent.',
    devices: (n) => (n === 1 ? '1 device signed up' : `${n} devices signed up`),
    loading: '…',
    notConfigured: 'The server has no VAPID keys, push is off.',
    unsupported: 'This browser cannot receive push messages.',
    insecure: 'Push works over HTTPS only.',
    iosInstall: 'On iPhone and iPad choose "Add to Home Screen" first and open the app from there.',
    denied: 'Notifications are blocked for this site. Allow them in the browser’s site settings.',
    failed: 'That did not work.',
  },
};

export type VeitWebPushSectionProps = {
  client: VeitWebPushClient;
  texts: VeitWebPushTexts;
  /** Readable text of a failed request (e.g. veitAuthErrorText); default texts.failed. */
  errorText?: (error: unknown) => string;
  /** Path of the generated service worker; default /sw.js. */
  serviceWorkerUrl?: string;
};

/** Account section: the user's switch, this device's subscription and a test notification. */
export function VeitWebPushSection({ client, texts, errorText, serviceWorkerUrl }: VeitWebPushSectionProps) {
  const push = useVeitWebPush(client, serviceWorkerUrl);
  const toast = useVeitToastOptional();
  const { status, support } = push;
  const message = (err: unknown) => errorText?.(err) ?? texts.failed;
  // Errors of the actions show in the box; a permission the user refused has its own hint.
  const quiet = (action: () => Promise<unknown>) => () => void action().catch(() => undefined);

  const notice =
    support === 'insecure'
      ? texts.insecure
      : support === 'ios-install'
        ? texts.iosInstall
        : support === 'unsupported'
          ? texts.unsupported
          : status && !status.configured
            ? texts.notConfigured
            : push.permission === 'denied'
              ? texts.denied
              : null;
  const deviceUsable = support === 'supported' && status?.configured === true && push.permission !== 'denied';
  const showError = push.error !== null && !(push.error instanceof Error && push.error.message.startsWith('notification permission'));

  return (
    <VeitAccountSection title={texts.title} description={texts.description}>
      <div className="flex flex-col gap-3">
        {notice && <VeitAlert variant="info">{notice}</VeitAlert>}
        {status === null ? (
          <p className="m-0 text-sm text-muted-foreground">{texts.loading}</p>
        ) : (
          <>
            <VeitSettingsToggleRow
              label={texts.enabled}
              description={texts.enabledHint}
              checked={status.enabled}
              disabled={push.busy}
              onCheckedChange={(value) => quiet(() => push.setEnabled(value))()}
            />
            <VeitSettingsToggleRow
              label={texts.thisDevice}
              description={texts.thisDeviceHint}
              checked={push.endpoint !== null}
              disabled={push.busy || (!deviceUsable && push.endpoint === null)}
              onCheckedChange={(value) => quiet(value ? push.enableDevice : push.disableDevice)()}
            />
            <p className="m-0 text-xs text-muted-foreground">{texts.devices(status.devices)}</p>
            <div className={VEIT_SETTINGS_ACTIONS}>
              <VeitButton
                variant="secondary"
                size="sm"
                disabled={push.busy || push.endpoint === null}
                onClick={quiet(async () => {
                  await push.test();
                  toast?.show('success', texts.testSent);
                })}
              >
                {texts.test}
              </VeitButton>
            </div>
          </>
        )}
        {showError && <VeitAlert variant="error">{message(push.error)}</VeitAlert>}
      </div>
    </VeitAccountSection>
  );
}
