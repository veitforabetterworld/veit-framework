import { useCallback, useEffect, useRef, useState } from 'react';
import {
  VEIT_WEB_PUSH_OPEN_MESSAGE,
  VEIT_WEB_PUSH_SW_URL,
  currentVeitPushSubscription,
  subscribeVeitPush,
  veitNotificationPermission,
  veitWebPushSupport,
  type VeitWebPushSupport,
} from './browser.js';
import type { VeitWebPushClient, VeitWebPushStatus } from './client.js';

export type VeitWebPushState = {
  support: VeitWebPushSupport;
  permission: NotificationPermission;
  /** null while loading or after an error. */
  status: VeitWebPushStatus | null;
  /** Endpoint of this browser's subscription, or null when this device gets nothing. */
  endpoint: string | null;
  busy: boolean;
  error: unknown;
  setEnabled: (enabled: boolean) => Promise<void>;
  /** Asks for permission and subscribes this device; call it from a click. */
  enableDevice: () => Promise<void>;
  disableDevice: () => Promise<void>;
  /** Test notification to this device; resolves with the number delivered. */
  test: () => Promise<number>;
};

/** Push for the signed-in user in this browser: switch, this device's subscription, test. */
export function useVeitWebPush(client: VeitWebPushClient, serviceWorkerUrl = VEIT_WEB_PUSH_SW_URL): VeitWebPushState {
  const [support] = useState<VeitWebPushSupport>(() => veitWebPushSupport());
  const [permission, setPermission] = useState<NotificationPermission>(() => veitNotificationPermission());
  const [status, setStatus] = useState<VeitWebPushStatus | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const clientRef = useRef(client);
  clientRef.current = client;

  useEffect(() => {
    let stop = false;
    void (async () => {
      try {
        const next = await clientRef.current.status();
        if (stop) return;
        setStatus(next);
        if (support !== 'supported') return;
        const subscription = await currentVeitPushSubscription(serviceWorkerUrl);
        if (stop) return;
        setEndpoint(subscription?.endpoint ?? null);
        // The server may have dropped it (other account, expired): register it again, quietly.
        if (subscription && next.configured && veitNotificationPermission() === 'granted') {
          await clientRef.current.subscribe(subscription.toJSON()).catch(() => undefined);
          if (!stop) setStatus(await clientRef.current.status());
        }
      } catch (err) {
        if (!stop) setError(err);
      }
    })();
    return () => {
      stop = true;
    };
  }, [support, serviceWorkerUrl]);

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    setBusy(true);
    setError(null);
    try {
      return await action();
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setBusy(false);
      setPermission(veitNotificationPermission());
    }
  }, []);

  const setEnabled = useCallback(
    (enabled: boolean) => run(async () => setStatus(await clientRef.current.setEnabled(enabled))),
    [run],
  );

  const enableDevice = useCallback(
    () =>
      run(async () => {
        const key = status?.public_key;
        if (!key) throw new Error('web push not configured');
        const subscription = await subscribeVeitPush(key, serviceWorkerUrl);
        await clientRef.current.subscribe(subscription.toJSON());
        setEndpoint(subscription.endpoint);
        let next = await clientRef.current.status();
        if (!next.enabled) next = await clientRef.current.setEnabled(true);
        setStatus(next);
      }),
    [run, status, serviceWorkerUrl],
  );

  const disableDevice = useCallback(
    () =>
      run(async () => {
        const subscription = await currentVeitPushSubscription(serviceWorkerUrl);
        const gone = subscription?.endpoint ?? endpoint;
        await subscription?.unsubscribe();
        if (gone) await clientRef.current.unsubscribe(gone);
        setEndpoint(null);
        setStatus(await clientRef.current.status());
      }),
    [run, endpoint, serviceWorkerUrl],
  );

  const test = useCallback(
    () => run(async () => (await clientRef.current.test(endpoint ?? undefined)).sent),
    [run, endpoint],
  );

  return { support, permission, status, endpoint, busy, error, setEnabled, enableDevice, disableDevice, test };
}

/**
 * Calls `open(path)` when the service worker reports a clicked notification while the app is open, so the host can
 * route inside the single-page app (e.g. react-router's navigate).
 */
export function useVeitWebPushOpen(open: (path: string) => void): void {
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const listener = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; url?: unknown } | null;
      if (data?.type !== VEIT_WEB_PUSH_OPEN_MESSAGE || typeof data.url !== 'string') return;
      const url = new URL(data.url, window.location.origin);
      if (url.origin !== window.location.origin) return;
      openRef.current(`${url.pathname}${url.search}${url.hash}`);
    };
    navigator.serviceWorker.addEventListener('message', listener);
    return () => navigator.serviceWorker.removeEventListener('message', listener);
  }, []);
}
