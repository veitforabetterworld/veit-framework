/**
 * Browser side of Web Push: support check, service worker, subscription. The service worker itself is generated
 * into the host's public folder by `veit-web-push-sw` (sw/cli.mjs), default `/sw.js`.
 */

/**
 * - supported: Push API and service worker available
 * - insecure: not https (or localhost), the browser refuses
 * - ios-install: Safari on iPhone/iPad, push only in the app added to the home screen
 * - unsupported: no Push API at all
 */
export type VeitWebPushSupport = 'supported' | 'insecure' | 'ios-install' | 'unsupported';

export const VEIT_WEB_PUSH_SW_URL = '/sw.js';
/** Message the service worker posts to an open window when a notification is clicked. */
export const VEIT_WEB_PUSH_OPEN_MESSAGE = 'veit-web-push-open';

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function veitWebPushSupport(): VeitWebPushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  if (!window.isSecureContext) return 'insecure';
  const api = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!api) return isIos() && !isStandalone() ? 'ios-install' : 'unsupported';
  return 'supported';
}

/** Current notification permission, or 'default' where the API is missing. */
export function veitNotificationPermission(): NotificationPermission {
  return typeof Notification === 'undefined' ? 'default' : Notification.permission;
}

/**
 * Registers the service worker (also what makes the app installable). Safe to call on every start; resolves to
 * null where service workers are not available.
 */
export async function registerVeitServiceWorker(url = VEIT_WEB_PUSH_SW_URL): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !window.isSecureContext) return null;
  try {
    return await navigator.serviceWorker.register(url, { scope: '/' });
  } catch {
    return null;
  }
}

function applicationServerKey(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** The subscription of this browser, or null. */
export async function currentVeitPushSubscription(url = VEIT_WEB_PUSH_SW_URL): Promise<PushSubscription | null> {
  const registration = await registerVeitServiceWorker(url);
  if (!registration || !('pushManager' in registration)) return null;
  return registration.pushManager.getSubscription();
}

/** Asks for permission (must run in a click) and subscribes this browser with the server's public key. */
export async function subscribeVeitPush(publicKey: string, url = VEIT_WEB_PUSH_SW_URL): Promise<PushSubscription> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(`notification permission ${permission}`);
  const registration = await registerVeitServiceWorker(url);
  if (!registration) throw new Error('no service worker');
  await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const key = applicationServerKey(publicKey);
  if (existing) {
    // A subscription made with another server key cannot receive our messages.
    const current = existing.options.applicationServerKey;
    const same =
      current !== null && current.byteLength === key.byteLength && new Uint8Array(current).every((b, i) => b === key[i]);
    if (same) return existing;
    await existing.unsubscribe();
  }
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}
