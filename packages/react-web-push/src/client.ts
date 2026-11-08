/** Push state of the signed-in user as GET /me/push of '@veit/web-push/express' sends it. */
export type VeitWebPushStatus = {
  /** VAPID keys are set on the server. */
  configured: boolean;
  public_key: string | null;
  /** The user's switch for all devices. */
  enabled: boolean;
  /** Subscribed browsers and devices of the user. */
  devices: number;
};

export type VeitWebPushClient = {
  status: () => Promise<VeitWebPushStatus>;
  setEnabled: (enabled: boolean) => Promise<VeitWebPushStatus>;
  subscribe: (subscription: PushSubscriptionJSON) => Promise<void>;
  unsubscribe: (endpoint: string) => Promise<void>;
  /** A test notification to one device (endpoint) or all. */
  test: (endpoint?: string) => Promise<{ sent: number }>;
};

type FetchJson = <T>(url: string, init?: { method?: string; body?: unknown }) => Promise<T>;

/** Client for /me/push of '@veit/web-push/express' at baseUrl; fetchJson is veitFetchJson from '@veit/react-auth'. */
export function createRestWebPushClient(baseUrl: string, fetchJson: FetchJson): VeitWebPushClient {
  const url = (path: string) => `${baseUrl.replace(/\/$/, '')}${path}`;
  return {
    status: () => fetchJson<VeitWebPushStatus>(url('/me/push')),
    setEnabled: (enabled) => fetchJson<VeitWebPushStatus>(url('/me/push'), { method: 'PUT', body: { enabled } }),
    subscribe: async (subscription) => {
      await fetchJson(url('/me/push/subscriptions'), { method: 'POST', body: subscription });
    },
    unsubscribe: async (endpoint) => {
      await fetchJson(url('/me/push/subscriptions'), { method: 'DELETE', body: { endpoint } });
    },
    test: (endpoint) => fetchJson<{ sent: number }>(url('/me/push/test'), { method: 'POST', body: endpoint ? { endpoint } : {} }),
  };
}
