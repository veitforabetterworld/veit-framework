import webpush from 'web-push';

/**
 * Standard Web Push (RFC 8030 with VAPID, RFC 8292): no vendor account, works in Chrome, Firefox, Edge and Safari,
 * in an installed PWA and in an Android TWA (notification delegation).
 *
 * A user has one subscription per browser or device and one switch for all of them (`enabled`, default on). The host
 * decides what to send; the service sends to every subscription of a user and removes the ones the push service
 * reports as gone (404, 410).
 */

export type UserId = string | number;

/** What PushSubscription.toJSON() gives in the browser. */
export type WebPushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type WebPushSubscriptionRecord = {
  id: string;
  userId: UserId;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  createdAt: Date;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
};

export interface WebPushStore {
  /** Inserts or moves the endpoint to this user (a browser has one endpoint, whoever is signed in). */
  upsert(userId: UserId, input: WebPushSubscriptionInput, userAgent: string | null): Promise<WebPushSubscriptionRecord>;
  /** Removes the endpoint of this user; false when there was none. */
  remove(userId: UserId, endpoint: string): Promise<boolean>;
  removeById(id: string): Promise<void>;
  list(userId: UserId): Promise<WebPushSubscriptionRecord[]>;
  markResult(id: string, ok: boolean): Promise<void>;
  /** Default true when the user never switched. */
  isEnabled(userId: UserId): Promise<boolean>;
  setEnabled(userId: UserId, enabled: boolean): Promise<void>;
}

export type WebPushVapid = { publicKey: string; privateKey: string; subject: string };

/** What the service worker of '@veit/react-web-push' shows. */
export type WebPushPayload = {
  title: string;
  body?: string;
  /** Opened (same origin) when the notification is clicked. */
  url?: string;
  /** A newer notification with the same tag replaces the older one. */
  tag?: string;
  icon?: string;
  badge?: string;
  requireInteraction?: boolean;
  /** Epoch milliseconds of the event the notification is about. */
  timestamp?: number;
  data?: Record<string, unknown>;
};

export type WebPushSendOptions = {
  /** Seconds the push service keeps an undelivered message; default 24 h. */
  ttl?: number;
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
  /** Only to this endpoint of the user (the test of one device). */
  endpoint?: string;
  /** Send although the user switched notifications off (only for an explicit test). */
  ignoreDisabled?: boolean;
};

export type WebPushSendResult = { sent: number; failed: number; removed: number };

/** Low-level send; the default uses the `web-push` library. Resolves with the push service's status code. */
export type WebPushSender = (
  subscription: WebPushSubscriptionInput,
  payload: string,
  options: { vapid: WebPushVapid; ttl: number; urgency: NonNullable<WebPushSendOptions['urgency']> },
) => Promise<{ statusCode: number }>;

export class WebPushError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

export const defaultWebPushSender: WebPushSender = async (subscription, payload, options) => {
  try {
    const result = await webpush.sendNotification(subscription, payload, {
      vapidDetails: options.vapid,
      TTL: options.ttl,
      urgency: options.urgency,
    });
    return { statusCode: result.statusCode };
  } catch (error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === 'number') return { statusCode };
    throw error;
  }
};

/** A fresh VAPID key pair (base64url), e.g. for a setup script: `node -e "…generateVapidKeys()…"`. */
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  return webpush.generateVAPIDKeys();
}

export type WebPushServiceOptions = {
  store: WebPushStore;
  /** Read on every call; null or empty keys mean push is not set up (the routes say so, nothing is sent). */
  vapid: () => WebPushVapid | null;
  sender?: WebPushSender;
  /** Subscriptions per user; the oldest beyond it are dropped. Default 20. */
  maxPerUser?: number;
  /** Called for every failed delivery that did not remove the subscription. */
  onError?: (error: unknown, subscription: WebPushSubscriptionRecord) => void;
};

const ENDPOINT_MAX = 2048;
const KEY_RE = /^[A-Za-z0-9_-]+={0,2}$/;

/** Checks the browser's subscription before it is stored: https endpoint, base64url keys. */
export function parseWebPushSubscription(body: unknown): WebPushSubscriptionInput | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof b.endpoint !== 'string' || b.endpoint.length > ENDPOINT_MAX) return null;
  let url: URL;
  try {
    url = new URL(b.endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const p256dh = b.keys?.p256dh;
  const auth = b.keys?.auth;
  if (typeof p256dh !== 'string' || typeof auth !== 'string') return null;
  if (!KEY_RE.test(p256dh) || !KEY_RE.test(auth) || p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint: b.endpoint, keys: { p256dh, auth } };
}

export class WebPushService {
  private readonly sender: WebPushSender;

  constructor(private readonly o: WebPushServiceOptions) {
    this.sender = o.sender ?? defaultWebPushSender;
  }

  private vapid(): WebPushVapid | null {
    const v = this.o.vapid();
    return v && v.publicKey && v.privateKey && v.subject ? v : null;
  }

  configured(): boolean {
    return this.vapid() !== null;
  }

  /** The application server key the browser subscribes with. */
  publicKey(): string | null {
    return this.vapid()?.publicKey ?? null;
  }

  async status(userId: UserId): Promise<{ configured: boolean; publicKey: string | null; enabled: boolean; devices: number }> {
    return {
      configured: this.configured(),
      publicKey: this.publicKey(),
      enabled: await this.o.store.isEnabled(userId),
      devices: (await this.o.store.list(userId)).length,
    };
  }

  setEnabled(userId: UserId, enabled: boolean): Promise<void> {
    return this.o.store.setEnabled(userId, enabled);
  }

  async subscribe(userId: UserId, body: unknown, userAgent: string | null = null): Promise<WebPushSubscriptionRecord> {
    const input = parseWebPushSubscription(body);
    if (!input) throw new WebPushError('web_push.subscription_invalid', 400);
    const record = await this.o.store.upsert(userId, input, userAgent ? userAgent.slice(0, 400) : null);
    const max = this.o.maxPerUser ?? 20;
    const all = await this.o.store.list(userId);
    if (all.length > max) {
      const oldest = [...all].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(0, all.length - max);
      for (const old of oldest) await this.o.store.removeById(old.id);
    }
    return record;
  }

  unsubscribe(userId: UserId, endpoint: string): Promise<boolean> {
    return this.o.store.remove(userId, endpoint);
  }

  /** Sends to the user's subscriptions (or one of them); nothing when push is off for the user or not set up. */
  async sendToUser(userId: UserId, payload: WebPushPayload, options: WebPushSendOptions = {}): Promise<WebPushSendResult> {
    const result: WebPushSendResult = { sent: 0, failed: 0, removed: 0 };
    const vapid = this.vapid();
    if (!vapid) return result;
    if (!options.ignoreDisabled && !(await this.o.store.isEnabled(userId))) return result;
    let subscriptions = await this.o.store.list(userId);
    if (options.endpoint !== undefined) subscriptions = subscriptions.filter((s) => s.endpoint === options.endpoint);
    const body = JSON.stringify(payload);
    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          const { statusCode } = await this.sender(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            body,
            { vapid, ttl: options.ttl ?? 24 * 3600, urgency: options.urgency ?? 'normal' },
          );
          if (statusCode >= 200 && statusCode < 300) {
            result.sent += 1;
            await this.o.store.markResult(subscription.id, true);
            return;
          }
          if (statusCode === 404 || statusCode === 410) {
            result.removed += 1;
            await this.o.store.removeById(subscription.id);
            return;
          }
          result.failed += 1;
          await this.o.store.markResult(subscription.id, false);
          this.o.onError?.(new WebPushError(`web_push.status_${statusCode}`, 502), subscription);
        } catch (error) {
          result.failed += 1;
          await this.o.store.markResult(subscription.id, false).catch(() => undefined);
          this.o.onError?.(error, subscription);
        }
      }),
    );
    return result;
  }
}

/** In-memory store for tests and small tools. */
export function createMemoryWebPushStore(): WebPushStore {
  const rows = new Map<string, WebPushSubscriptionRecord>();
  const disabled = new Set<string>();
  let next = 1;
  return {
    async upsert(userId, input, userAgent) {
      const existing = [...rows.values()].find((r) => r.endpoint === input.endpoint);
      const record: WebPushSubscriptionRecord = {
        id: existing?.id ?? String(next++),
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent,
        createdAt: existing?.createdAt ?? new Date(),
        lastSuccessAt: existing?.lastSuccessAt ?? null,
        lastFailureAt: existing?.lastFailureAt ?? null,
      };
      rows.set(record.id, record);
      return record;
    },
    async remove(userId, endpoint) {
      const found = [...rows.values()].find((r) => String(r.userId) === String(userId) && r.endpoint === endpoint);
      if (!found) return false;
      rows.delete(found.id);
      return true;
    },
    async removeById(id) {
      rows.delete(id);
    },
    async list(userId) {
      return [...rows.values()].filter((r) => String(r.userId) === String(userId));
    },
    async markResult(id, ok) {
      const row = rows.get(id);
      if (!row) return;
      if (ok) row.lastSuccessAt = new Date();
      else row.lastFailureAt = new Date();
    },
    async isEnabled(userId) {
      return !disabled.has(String(userId));
    },
    async setEnabled(userId, enabled) {
      if (enabled) disabled.delete(String(userId));
      else disabled.add(String(userId));
    },
  };
}
