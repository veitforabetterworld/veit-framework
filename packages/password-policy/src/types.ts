/**
 * The browser-safe part of '@veit/password-policy': constants, reason codes and their guard, no Node or zxcvbn.
 * Web apps get these through '@veit/react-auth'.
 */

export const PASSWORD_MIN_LENGTH = 10;

/** Why a password counts as insecure; also `password_security_reasons` of a login answer. */
export type PasswordSecurityReason = 'too_short' | 'too_weak' | 'pwned';

export const PASSWORD_SECURITY_REASONS: readonly PasswordSecurityReason[] = ['too_short', 'too_weak', 'pwned'];

export type PasswordPolicyErrorCode = PasswordSecurityReason | 'check_unavailable';

export type PasswordSecurityEvaluation = {
  safe: boolean;
  reasons: PasswordSecurityReason[];
  checkUnavailable: boolean;
  zxcvbnScore: number;
  pwnedCount: number | null;
};

export function isPasswordSecurityReason(value: unknown): value is PasswordSecurityReason {
  return typeof value === 'string' && (PASSWORD_SECURITY_REASONS as readonly string[]).includes(value);
}

/** The known reasons of a wire list (`string[]`), unknown ones dropped. */
export function passwordSecurityReasons(values: readonly unknown[] | null | undefined): PasswordSecurityReason[] {
  return (values ?? []).filter(isPasswordSecurityReason);
}
