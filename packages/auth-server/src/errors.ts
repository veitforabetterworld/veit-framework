/**
 * A failure the client should see. code is an i18n key ('auth.invalid_credentials'); status the HTTP status.
 * reasons carries password policy reasons where the code is about a weak password.
 */
export class AuthError extends Error {
  readonly code: string;
  readonly status: number;
  readonly reasons?: string[];

  constructor(code: string, status: number, reasons?: string[]) {
    super(code);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
    this.reasons = reasons;
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

export function authFail(code: string, status: number, reasons?: string[]): never {
  throw new AuthError(code, status, reasons);
}
