import type { VeitSettingsValues } from './VeitSettingsGroups.js';

type FetchJson = <T>(url: string, init?: { method?: string; body?: unknown }) => Promise<T>;

export type VeitAppSettingsClient = {
  list: () => Promise<VeitSettingsValues>;
  /** Secrets: '' keeps the stored one, null deletes it. Answers with the new list. */
  save: (values: Record<string, string | null>) => Promise<VeitSettingsValues>;
  reveal: (key: string) => Promise<string>;
};

/** Client for the router of '@veit/app-settings/express' at baseUrl; fetchJson is veitFetchJson from '@veit/react-auth'. */
export function createRestAppSettingsClient(baseUrl: string, fetchJson: FetchJson): VeitAppSettingsClient {
  const url = (path: string) => `${baseUrl.replace(/\/$/, '')}${path}`;
  return {
    list: async () => (await fetchJson<{ settings: VeitSettingsValues }>(url('/'))).settings,
    save: async (values) => (await fetchJson<{ settings: VeitSettingsValues }>(url('/'), { method: 'PUT', body: values })).settings,
    reveal: async (key) => (await fetchJson<{ value: string }>(url(`/${encodeURIComponent(key)}/secret`))).value,
  };
}
