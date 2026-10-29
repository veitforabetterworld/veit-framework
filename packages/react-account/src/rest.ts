import type { AccountClient, AccountSession } from './types.js';

type FetchJson = <T>(url: string, init?: { method?: string; body?: unknown }) => Promise<T>;

type WireSession = {
  id: string | number;
  login_time: string;
  last_used_at: string;
  ip_address: string | null;
  device: string;
  is_current: boolean;
};

export type VeitRestAccountClient = AccountClient & {
  resendVerification: () => Promise<void>;
};

/**
 * AccountClient for the Express adapter of '@veit/auth-server' at baseUrl. fetchJson is veitFetchJson from
 * '@veit/react-auth' (passed in so this package does not depend on it). formatTime renders "last used" in sessions.
 */
export function createRestAccountClient(
  baseUrl: string,
  fetchJson: FetchJson,
  formatTime: (iso: string) => string = (iso) => new Date(iso).toLocaleString(),
): VeitRestAccountClient {
  const url = (path: string) => `${baseUrl.replace(/\/$/, '')}${path}`;
  return {
    patchProfile: async (patch) => {
      await fetchJson(url('/me'), {
        method: 'PATCH',
        body: { first_name: patch.firstName, last_name: patch.lastName, email: patch.email },
      });
    },
    changePassword: async ({ currentPassword, newPassword }) => {
      await fetchJson(url('/me/password'), {
        method: 'POST',
        body: { current_password: currentPassword, new_password: newPassword },
      });
    },
    listSessions: async () => {
      const { sessions } = await fetchJson<{ sessions: WireSession[] }>(url('/me/sessions'));
      return sessions.map(
        (s): AccountSession => ({
          id: s.id,
          isCurrent: s.is_current,
          summary: s.device || s.ip_address || '—',
          detail: [formatTime(s.last_used_at), s.ip_address].filter(Boolean).join(' · '),
        }),
      );
    },
    revokeSession: async (id) => {
      await fetchJson(url(`/me/sessions/${encodeURIComponent(String(id))}`), { method: 'DELETE' });
    },
    getMfaStatus: async () => {
      const s = await fetchJson<{ mfa_enabled: boolean; mfa_method: 'totp' | 'email' | null }>(url('/me/mfa'));
      return { mfaEnabled: s.mfa_enabled, mfaMethod: s.mfa_method };
    },
    startTotpMfa: async () => {
      const s = await fetchJson<{ otpauth_uri: string; secret_base32: string }>(url('/me/mfa/totp/start'), { method: 'POST' });
      return { otpauthUri: s.otpauth_uri, secretBase32: s.secret_base32 };
    },
    confirmTotpMfa: async (code) => {
      await fetchJson(url('/me/mfa/totp/confirm'), { method: 'POST', body: { code } });
    },
    startEmailMfa: async () => {
      const r = await fetchJson<{ message?: string }>(url('/me/mfa/email/start'), { method: 'POST' });
      return { messageKey: r.message };
    },
    confirmEmailMfa: async (code) => {
      await fetchJson(url('/me/mfa/email/confirm'), { method: 'POST', body: { code } });
    },
    disableMfa: async (currentPassword) => {
      await fetchJson(url('/me/mfa/disable'), { method: 'POST', body: { current_password: currentPassword } });
    },
    requestDeletion: async () => {
      await fetchJson(url('/me'), { method: 'DELETE' });
    },
    resendVerification: async () => {
      await fetchJson(url('/auth/verification/resend'), { method: 'POST' });
    },
  };
}
