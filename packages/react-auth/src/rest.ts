import type { AuthClient, AuthLoginResult, AuthRegisterInput } from './types.js';

/** A failed call to the account API; code is the i18n key the server sent ('auth.invalid_credentials'). */
export class VeitApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly reasons: string[];

  constructor(status: number, code: string, reasons: string[] = []) {
    super(code);
    this.name = 'VeitApiError';
    this.status = status;
    this.code = code;
    this.reasons = reasons;
  }
}

/** JSON request with the session cookie; throws VeitApiError on a non-2xx answer. */
export async function veitFetchJson<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? 'GET',
    credentials: 'include',
    headers: init?.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let body: Record<string, unknown> | null = null;
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = null;
    }
  }
  if (!res.ok) {
    const code = typeof body?.code === 'string' ? body.code : typeof body?.error === 'string' ? body.error : `http_${res.status}`;
    throw new VeitApiError(res.status, code, Array.isArray(body?.reasons) ? (body.reasons as string[]) : []);
  }
  return body as T;
}

/** User as the '@veit/auth-server' Express adapter sends it, plus whatever the host adds (extendUser). */
export type VeitWireUser = {
  id: string | number;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  email_verified_at: string | null;
  mfa_enabled: boolean;
  mfa_method: 'totp' | 'email' | null;
  created_at: string;
  [extra: string]: unknown;
};

export type VeitRestAuthClient<User> = AuthClient<User> & {
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  suggestPassword: () => Promise<string>;
};

/**
 * AuthClient for the Express adapter of '@veit/auth-server', mounted at baseUrl (e.g. '/api/v1').
 * mapUser turns the wire user into the host's user type.
 */
export function createRestAuthClient<User = VeitWireUser>(
  baseUrl: string,
  mapUser: (wire: VeitWireUser) => User = (wire) => wire as unknown as User,
): VeitRestAuthClient<User> {
  const url = (path: string) => `${baseUrl.replace(/\/$/, '')}${path}`;
  type LoginWire =
    | { mfa_required: true; mfa_token: string; mfa_methods: string[] }
    | { mfa_required: false; password_insecure: boolean; password_security_reasons: string[] };

  const loginResult = (wire: LoginWire): AuthLoginResult =>
    wire.mfa_required
      ? { needsMfa: true, mfaToken: wire.mfa_token, mfaMethods: wire.mfa_methods }
      : { needsMfa: false, passwordInsecure: wire.password_insecure, passwordSecurityReasons: wire.password_security_reasons };

  return {
    getCurrentUser: async () => mapUser(await veitFetchJson<VeitWireUser>(url('/me'))),
    login: async (email, password) =>
      loginResult(await veitFetchJson<LoginWire>(url('/auth/login'), { method: 'POST', body: { email, password } })),
    completeMfaLogin: async (mfaToken, code) => {
      const wire = await veitFetchJson<LoginWire>(url('/auth/login/mfa'), { method: 'POST', body: { mfa_token: mfaToken, code } });
      const result = loginResult(wire);
      return result.needsMfa ? {} : { passwordInsecure: result.passwordInsecure, passwordSecurityReasons: result.passwordSecurityReasons };
    },
    sendLoginMfaEmailCode: async (mfaToken) =>
      veitFetchJson<{ message?: string }>(url('/auth/login/mfa/email'), { method: 'POST', body: { mfa_token: mfaToken } }).then(
        (r) => ({ messageKey: r.message }),
      ),
    register: async (input: AuthRegisterInput) => {
      const result = await veitFetchJson<{ message: string }>(url('/auth/register'), {
        method: 'POST',
        body: { email: input.email, password: input.password, first_name: input.firstName, last_name: input.lastName },
      });
      return result.message;
    },
    logout: async () => {
      await veitFetchJson(url('/auth/logout'), { method: 'POST' });
    },
    requestPasswordReset: async (email) => {
      await veitFetchJson(url('/auth/password-reset'), { method: 'POST', body: { email } });
    },
    confirmPasswordReset: async (token, newPassword) => {
      await veitFetchJson(url('/auth/password-reset/confirm'), { method: 'POST', body: { token, new_password: newPassword } });
    },
    verifyEmail: async (token) => {
      await veitFetchJson(url('/auth/verify-email'), { method: 'POST', body: { token } });
    },
    resendVerification: async () => {
      await veitFetchJson(url('/auth/verification/resend'), { method: 'POST' });
    },
    suggestPassword: async () => (await veitFetchJson<{ password: string }>(url('/auth/suggest-password'))).password,
  };
}
