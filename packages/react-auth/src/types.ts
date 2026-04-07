export type AuthMfaMethod = string;

export type AuthLoginResult =
  | { needsMfa: false }
  | { needsMfa: true; mfaToken: string; mfaMethods: AuthMfaMethod[] };

export type AuthRegisterInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  allowDirectOrgAdd?: boolean;
};

export interface AuthClient<User> {
  getCurrentUser: () => Promise<User>;
  login: (email: string, password: string) => Promise<AuthLoginResult>;
  completeMfaLogin: (mfaToken: string, code: string) => Promise<void>;
  register: (input: AuthRegisterInput) => Promise<string>;
  logout: () => Promise<void>;
  sendLoginMfaEmailCode?: (mfaToken: string) => Promise<{ messageKey?: string }>;
  requestPasswordReset?: (email: string) => Promise<void>;
  confirmPasswordReset?: (token: string, newPassword: string) => Promise<void>;
}
