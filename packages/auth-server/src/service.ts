import { createHash, randomBytes, randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { generateSecret, generateURI, verifySync } from 'otplib';
import {
  assertStrongPassword,
  evaluatePasswordSecurity,
  isPasswordPolicyError,
  type PasswordPolicyErrorCode,
} from '@veit/password-policy';
import { authFail } from './errors.js';
import type {
  AuthMailer,
  AuthStore,
  AuthUserPatch,
  AuthUserRecord,
  RequestInfo,
  SecretBox,
  SessionRecord,
  UserId,
} from './types.js';

export type AuthServiceOptions = {
  store: AuthStore;
  mailer: AuthMailer;
  secretBox: SecretBox;
  /** Issuer shown in authenticator apps. */
  totpIssuer: string;
  /** Link in the verification mail; default `${origin}/verify-email?token=…`. */
  verifyEmailUrl?: (token: string, origin: string) => string;
  /** Link in the reset mail; default `${origin}/reset-password?token=…`. */
  resetPasswordUrl?: (token: string, origin: string) => string;
  /** Called before a user is deleted, e.g. to keep the last admin or remove owned data. May throw an AuthError. */
  beforeDeleteUser?: (userId: UserId) => Promise<void>;
  /** Called after a user has verified the e-mail address (e.g. to grant the first admin). */
  afterEmailVerified?: (userId: UserId) => Promise<void>;
  /** Called after a registration (e.g. to make the very first account an admin while no mail can be sent yet). */
  afterRegister?: (userId: UserId) => Promise<void>;
  /** A suggested password for the register form; default 24 random characters. */
  suggestPassword?: () => Promise<string>;
  sessionLifetimeSec?: number;
  verificationValidHours?: number;
  passwordResetValidMinutes?: number;
  passwordResetMaxPerDay?: number;
  mfaChallengeTtlSec?: number;
  mfaEmailOtpTtlSec?: number;
  mfaEmailMinIntervalSec?: number;
  mfaEmailMaxSends?: number;
  mfaSetupTtlSec?: number;
};

export type LoginResult =
  | { mfaRequired: true; mfaToken: string; mfaMethods: string[] }
  | {
      mfaRequired: false;
      user: AuthUserRecord;
      session: { token: string; expiresAt: Date };
      passwordInsecure: boolean;
      passwordSecurityReasons: string[];
    };

export type ProfilePatch = { firstName?: string; lastName?: string; email?: string };

const BCRYPT_ROUNDS = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOUCH_INTERVAL_MS = 5 * 60_000;

const POLICY_CODES: Record<PasswordPolicyErrorCode, [string, number]> = {
  check_unavailable: ['auth.password_check_unavailable', 503],
  too_short: ['auth.password_too_short', 400],
  too_weak: ['auth.password_too_weak', 400],
  pwned: ['auth.password_pwned', 400],
};

const MFA_RESET: AuthUserPatch = {
  mfaEnabled: false,
  mfaMethod: null,
  mfaTotpSecretEnc: null,
  mfaTotpSetupSecretEnc: null,
  mfaTotpSetupExpiresAt: null,
  mfaEmailSetupCodeHash: null,
  mfaEmailSetupExpiresAt: null,
};

export function sha256hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function newToken(): string {
  return randomBytes(32).toString('hex');
}

function sixDigits(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function codeOf(raw: string): string {
  const code = raw.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) authFail('auth.mfa_invalid', 400);
  return code;
}

async function strongPassword(password: string): Promise<void> {
  try {
    await assertStrongPassword(password);
  } catch (error) {
    if (isPasswordPolicyError(error)) {
      const [code, status] = POLICY_CODES[error.code];
      authFail(code, status);
    }
    throw error;
  }
}

/**
 * Account flows independent of the web framework. Every failure is an AuthError with an i18n code; the transport
 * (see '@veit/auth-server/express') turns results into cookies and JSON.
 */
/** A mail that cannot be sent becomes 'auth.mail_unavailable' (503) instead of a bare 500. */
async function mail(send: () => Promise<void>): Promise<void> {
  try {
    await send();
  } catch (error) {
    console.error('[auth] mail failed', error);
    authFail('auth.mail_unavailable', 503);
  }
}

export class AuthService {
  private readonly o: Required<
    Omit<AuthServiceOptions, 'beforeDeleteUser' | 'afterEmailVerified' | 'afterRegister' | 'verifyEmailUrl' | 'resetPasswordUrl' | 'suggestPassword'>
  > &
    Pick<AuthServiceOptions, 'beforeDeleteUser' | 'afterEmailVerified' | 'afterRegister' | 'suggestPassword'> & {
      verifyEmailUrl: (token: string, origin: string) => string;
      resetPasswordUrl: (token: string, origin: string) => string;
    };
  private readonly lastTouch = new Map<string, number>();

  constructor(options: AuthServiceOptions) {
    this.o = {
      sessionLifetimeSec: 7 * 24 * 3600,
      verificationValidHours: 24,
      passwordResetValidMinutes: 60,
      passwordResetMaxPerDay: 2,
      mfaChallengeTtlSec: 600,
      mfaEmailOtpTtlSec: 300,
      mfaEmailMinIntervalSec: 60,
      mfaEmailMaxSends: 5,
      mfaSetupTtlSec: 900,
      verifyEmailUrl: (token, origin) => `${origin}/verify-email?token=${encodeURIComponent(token)}`,
      resetPasswordUrl: (token, origin) => `${origin}/reset-password?token=${encodeURIComponent(token)}`,
      ...options,
    };
  }

  get sessionLifetimeSec(): number {
    return this.o.sessionLifetimeSec;
  }

  private get store(): AuthStore {
    return this.o.store;
  }

  private async requireUser(id: UserId): Promise<AuthUserRecord> {
    const user = await this.store.findUserById(id);
    if (!user) authFail('auth.user_not_found', 404);
    return user;
  }

  private async newSession(userId: UserId, req: RequestInfo): Promise<{ token: string; expiresAt: Date }> {
    const token = newToken();
    const expiresAt = new Date(Date.now() + this.o.sessionLifetimeSec * 1000);
    await this.store.createSession({
      userId,
      token,
      expiresAt,
      ipAddress: req.ip?.slice(0, 45) ?? null,
      userAgent: req.userAgent?.slice(0, 512) ?? null,
      deviceName: req.deviceName ?? null,
    });
    return { token, expiresAt };
  }

  private async sendVerification(user: { email: string }, token: string, origin: string): Promise<void> {
    await mail(() => this.o.mailer.sendVerification({ to: user.email, token, url: this.o.verifyEmailUrl(token, origin) }));
  }

  // ---------------------------------------------------------------- registration and login

  async register(
    input: { email: string; password: string; firstName: string; lastName: string },
    req: RequestInfo,
  ): Promise<{ user: AuthUserRecord; session: { token: string; expiresAt: Date }; resent: boolean; mailSent: boolean }> {
    await this.store.purgeExpired();
    const email = normalizeEmail(input.email);
    const firstName = input.firstName.trim().slice(0, 255);
    const lastName = input.lastName.trim().slice(0, 255);
    if (!firstName || !lastName) authFail('auth.first_last_name_required', 400);
    if (!EMAIL_RE.test(email)) authFail('auth.invalid_email', 400);
    await strongPassword(input.password);
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const token = newToken();
    const expires = new Date(Date.now() + this.o.verificationValidHours * 3600_000);

    const existing = await this.store.findUserByEmail(email);
    let id: UserId;
    if (existing) {
      // An unverified address may be registered again; the old attempt is overwritten.
      if (existing.emailVerifiedAt) authFail('auth.email_already_registered', 409);
      await this.store.updateUser(existing.id, {
        email,
        firstName,
        lastName,
        passwordHash,
        emailVerificationToken: token,
        emailVerificationExpiresAt: expires,
      });
      id = existing.id;
    } else {
      id = await this.store.insertUser({
        email,
        firstName,
        lastName,
        passwordHash,
        emailVerificationToken: token,
        emailVerificationExpiresAt: expires,
      });
    }
    await this.o.afterRegister?.(id);
    const session = await this.newSession(id, req);
    // The account stands even when the mail fails; the user can ask for the link again later.
    let mailSent = true;
    try {
      await this.sendVerification({ email }, token, req.origin);
    } catch {
      mailSent = false;
    }
    return { user: await this.requireUser(id), session, resent: existing !== null, mailSent };
  }

  async verifyEmail(token: string): Promise<AuthUserRecord> {
    const trimmed = token.trim();
    if (!trimmed) authFail('auth.verification_invalid', 400);
    const user = await this.store.findUserByVerificationToken(trimmed);
    if (!user || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
      authFail('auth.verification_invalid', 400);
    }
    await this.store.updateUser(user.id, {
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
      emailVerificationExpiresAt: null,
    });
    await this.o.afterEmailVerified?.(user.id);
    return this.requireUser(user.id);
  }

  async resendVerification(userId: UserId, req: RequestInfo): Promise<void> {
    const user = await this.requireUser(userId);
    if (user.emailVerifiedAt) authFail('auth.email_already_verified', 400);
    const token = newToken();
    await this.store.updateUser(user.id, {
      emailVerificationToken: token,
      emailVerificationExpiresAt: new Date(Date.now() + this.o.verificationValidHours * 3600_000),
    });
    await this.sendVerification(user, token, req.origin);
  }

  async login(emailRaw: string, password: string, req: RequestInfo): Promise<LoginResult> {
    const email = normalizeEmail(emailRaw);
    if (!email || !password) authFail('auth.login_credentials_required', 400);
    const user = await this.store.findUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) authFail('auth.invalid_credentials', 401);
    const warning = await evaluatePasswordSecurity(password, { failClosed: false });
    const passwordInsecure = !warning.safe;
    const passwordSecurityReasons = [...warning.reasons];

    if (user.mfaEnabled && (user.mfaMethod === 'totp' || user.mfaMethod === 'email')) {
      const mfaToken = newToken();
      await this.store.createMfaChallenge({
        userId: user.id,
        tokenHash: sha256hex(mfaToken),
        expiresAt: new Date(Date.now() + this.o.mfaChallengeTtlSec * 1000),
        passwordInsecure,
        passwordSecurityReasons,
      });
      return { mfaRequired: true, mfaToken, mfaMethods: [user.mfaMethod] };
    }
    const session = await this.newSession(user.id, req);
    return { mfaRequired: false, user, session, passwordInsecure, passwordSecurityReasons };
  }

  async loginMfa(mfaToken: string, codeRaw: string, req: RequestInfo): Promise<LoginResult> {
    if (!mfaToken.trim()) authFail('auth.mfa_invalid', 400);
    const code = codeOf(codeRaw);
    const challenge = await this.store.findMfaChallenge(sha256hex(mfaToken.trim()));
    if (!challenge) authFail('auth.mfa_challenge_invalid', 401);
    const user = await this.store.findUserById(challenge.userId);
    if (!user || !user.mfaEnabled) authFail('auth.mfa_challenge_invalid', 401);

    let ok = false;
    if (user.mfaMethod === 'totp') {
      const secret = this.o.secretBox.decrypt(user.mfaTotpSecretEnc ?? '');
      ok = secret !== '' && verifySync({ secret, token: code }).valid === true;
    } else if (user.mfaMethod === 'email') {
      if (challenge.emailOtpHash && challenge.emailOtpExpiresAt && challenge.emailOtpExpiresAt > new Date()) {
        ok = await bcrypt.compare(code, challenge.emailOtpHash);
      }
    }
    if (!ok) authFail('auth.mfa_invalid', 401);
    await this.store.deleteMfaChallenges(user.id);
    const session = await this.newSession(user.id, req);
    return {
      mfaRequired: false,
      user,
      session,
      passwordInsecure: challenge.passwordInsecure,
      passwordSecurityReasons: challenge.passwordSecurityReasons,
    };
  }

  async sendLoginMfaEmail(mfaToken: string): Promise<void> {
    if (!mfaToken.trim()) authFail('auth.mfa_challenge_invalid', 400);
    const challenge = await this.store.findMfaChallenge(sha256hex(mfaToken.trim()));
    if (!challenge) authFail('auth.mfa_challenge_invalid', 400);
    const user = await this.store.findUserById(challenge.userId);
    if (!user || !user.mfaEnabled || user.mfaMethod !== 'email') authFail('auth.mfa_challenge_invalid', 400);
    if (challenge.emailSendCount >= this.o.mfaEmailMaxSends) authFail('auth.mfa_email_rate_limited', 429);
    if (challenge.lastEmailSentAt && Date.now() < challenge.lastEmailSentAt.getTime() + this.o.mfaEmailMinIntervalSec * 1000) {
      authFail('auth.mfa_email_wait', 429);
    }
    const code = sixDigits();
    await this.store.updateMfaChallenge(challenge.id, {
      emailOtpHash: await bcrypt.hash(code, BCRYPT_ROUNDS),
      emailOtpExpiresAt: new Date(Date.now() + this.o.mfaEmailOtpTtlSec * 1000),
      emailSendCount: challenge.emailSendCount + 1,
      lastEmailSentAt: new Date(),
    });
    await mail(() => this.o.mailer.sendMfaLoginCode({ to: user.email, code }));
  }

  // ---------------------------------------------------------------- sessions

  /** The user of a session cookie, or null. Touches last_used_at at most every five minutes. */
  async userForSession(token: string | null | undefined): Promise<AuthUserRecord | null> {
    if (!token) return null;
    const user = await this.store.findSessionUser(token);
    if (!user) return null;
    const now = Date.now();
    if ((this.lastTouch.get(token) ?? 0) < now - TOUCH_INTERVAL_MS) {
      this.lastTouch.set(token, now);
      if (this.lastTouch.size > 10_000) this.lastTouch.clear();
      await this.store.touchSession(token);
    }
    return user;
  }

  /** A session for a user the host has proven itself, e.g. a host that signs in on the e-mail confirmation link. */
  async openSession(userId: UserId, req: RequestInfo): Promise<{ token: string; expiresAt: Date }> {
    await this.requireUser(userId);
    return this.newSession(userId, req);
  }

  async logout(token: string | null | undefined): Promise<void> {
    if (token) await this.store.revokeSessionByToken(token);
  }

  async listSessions(userId: UserId, currentToken: string | null): Promise<SessionRecord[]> {
    if (currentToken) await this.store.touchSession(currentToken);
    return this.store.listSessions(userId, currentToken);
  }

  async revokeSession(userId: UserId, sessionId: UserId): Promise<void> {
    if (!(await this.store.revokeSession(userId, sessionId))) authFail('auth.session_not_found', 404);
  }

  // ---------------------------------------------------------------- password

  async suggestPassword(): Promise<string> {
    if (this.o.suggestPassword) return this.o.suggestPassword();
    // No look-alikes (0/O, 1/l/I); 24 characters from 54 are about 138 bits.
    const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 24 }, () => alphabet[randomInt(0, alphabet.length)]).join('');
  }

  async requestPasswordReset(emailRaw: string, req: RequestInfo): Promise<void> {
    await this.store.purgeExpired();
    const email = normalizeEmail(emailRaw);
    if (!EMAIL_RE.test(email)) authFail('auth.invalid_email', 400);
    const emailHash = sha256hex(email);
    const since = new Date(Date.now() - 24 * 3600_000);
    if ((await this.store.countPasswordResets(emailHash, since)) >= this.o.passwordResetMaxPerDay) {
      authFail('auth.password_reset_too_many_requests', 429);
    }
    const user = await this.store.findUserByEmail(email);
    const token = newToken();
    await this.store.insertPasswordReset({
      userId: user?.id ?? null,
      emailHash,
      tokenHash: sha256hex(token),
      expiresAt: new Date(Date.now() + this.o.passwordResetValidMinutes * 60_000),
      requestIp: req.ip?.slice(0, 64) ?? null,
    });
    // Same answer whether the address exists or not.
    if (user) {
      await mail(() => this.o.mailer.sendPasswordReset({ to: user.email, token, url: this.o.resetPasswordUrl(token, req.origin) }));
    }
  }

  /** Sets the new password, ends every session and turns MFA off (the reset proves only the mailbox). */
  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    await this.store.purgeExpired();
    if (!token.trim()) authFail('auth.password_reset_invalid', 400);
    const reset = await this.store.findPasswordReset(sha256hex(token.trim()));
    if (!reset?.userId) authFail('auth.password_reset_invalid', 400);
    await strongPassword(newPassword);
    await this.store.updateUser(reset.userId, { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS), ...MFA_RESET });
    await this.store.markPasswordResetUsed(reset.id);
    await this.store.deleteMfaChallenges(reset.userId);
    await this.store.revokeAllSessions(reset.userId);
  }

  /** Ends all sessions and opens a new one for the caller. */
  async changePassword(
    userId: UserId,
    currentPassword: string,
    newPassword: string,
    req: RequestInfo,
  ): Promise<{ token: string; expiresAt: Date }> {
    const user = await this.requireUser(userId);
    await strongPassword(newPassword);
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) authFail('auth.wrong_password', 400);
    await this.store.updateUser(user.id, { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) });
    await this.store.revokeAllSessions(user.id);
    return this.newSession(user.id, req);
  }

  // ---------------------------------------------------------------- profile

  /** A new e-mail address must be verified again. */
  async patchProfile(userId: UserId, patch: ProfilePatch, req: RequestInfo): Promise<AuthUserRecord> {
    const user = await this.requireUser(userId);
    const updates: AuthUserPatch = {};
    if (patch.firstName !== undefined || patch.lastName !== undefined) {
      const firstName = (patch.firstName ?? user.firstName).trim().slice(0, 255);
      const lastName = (patch.lastName ?? user.lastName).trim().slice(0, 255);
      if (!firstName || !lastName) authFail('auth.first_last_name_required', 400);
      updates.firstName = firstName;
      updates.lastName = lastName;
    }
    let verificationToken: string | null = null;
    if (patch.email !== undefined && normalizeEmail(patch.email) !== user.email) {
      const email = normalizeEmail(patch.email);
      if (!EMAIL_RE.test(email)) authFail('auth.invalid_email', 400);
      const other = await this.store.findUserByEmail(email);
      if (other && other.id !== user.id) authFail('auth.email_already_registered', 409);
      verificationToken = newToken();
      updates.email = email;
      updates.emailVerifiedAt = null;
      updates.emailVerificationToken = verificationToken;
      updates.emailVerificationExpiresAt = new Date(Date.now() + this.o.verificationValidHours * 3600_000);
    }
    if (Object.keys(updates).length > 0) await this.store.updateUser(user.id, updates);
    if (verificationToken && updates.email) await this.sendVerification({ email: updates.email }, verificationToken, req.origin);
    return this.requireUser(user.id);
  }

  async deleteAccount(userId: UserId): Promise<void> {
    await this.requireUser(userId);
    await this.o.beforeDeleteUser?.(userId);
    await this.store.deleteUser(userId);
  }

  // ---------------------------------------------------------------- MFA setup

  async startTotpSetup(userId: UserId): Promise<{ secretBase32: string; otpauthUri: string }> {
    const user = await this.requireUser(userId);
    if (user.mfaEnabled) authFail('auth.mfa_already_enabled', 400);
    const secret = generateSecret();
    let encrypted: string;
    try {
      encrypted = this.o.secretBox.encrypt(secret);
    } catch {
      authFail('auth.mfa_server_misconfigured', 500);
    }
    await this.store.updateUser(user.id, {
      mfaTotpSetupSecretEnc: encrypted,
      mfaTotpSetupExpiresAt: new Date(Date.now() + this.o.mfaSetupTtlSec * 1000),
      mfaEmailSetupCodeHash: null,
      mfaEmailSetupExpiresAt: null,
    });
    return { secretBase32: secret, otpauthUri: generateURI({ issuer: this.o.totpIssuer, label: user.email, secret }) };
  }

  async confirmTotpSetup(userId: UserId, codeRaw: string): Promise<void> {
    const code = codeOf(codeRaw);
    const user = await this.requireUser(userId);
    if (!user.mfaTotpSetupSecretEnc || user.mfaEnabled || !user.mfaTotpSetupExpiresAt || user.mfaTotpSetupExpiresAt < new Date()) {
      authFail('auth.mfa_setup_expired', 400);
    }
    const secret = this.o.secretBox.decrypt(user.mfaTotpSetupSecretEnc);
    if (!secret || verifySync({ secret, token: code }).valid !== true) authFail('auth.mfa_invalid', 400);
    await this.store.updateUser(user.id, {
      ...MFA_RESET,
      mfaEnabled: true,
      mfaMethod: 'totp',
      mfaTotpSecretEnc: this.o.secretBox.encrypt(secret),
    });
  }

  async startEmailMfaSetup(userId: UserId): Promise<void> {
    const user = await this.requireUser(userId);
    if (user.mfaEnabled) authFail('auth.mfa_already_enabled', 400);
    const code = sixDigits();
    await this.store.updateUser(user.id, {
      mfaEmailSetupCodeHash: await bcrypt.hash(code, BCRYPT_ROUNDS),
      mfaEmailSetupExpiresAt: new Date(Date.now() + this.o.mfaSetupTtlSec * 1000),
      mfaTotpSetupSecretEnc: null,
      mfaTotpSetupExpiresAt: null,
    });
    await mail(() => this.o.mailer.sendMfaSetupCode({ to: user.email, code }));
  }

  async confirmEmailMfaSetup(userId: UserId, codeRaw: string): Promise<void> {
    const code = codeOf(codeRaw);
    const user = await this.requireUser(userId);
    if (!user.mfaEmailSetupCodeHash || user.mfaEnabled || !user.mfaEmailSetupExpiresAt || user.mfaEmailSetupExpiresAt < new Date()) {
      authFail('auth.mfa_setup_expired', 400);
    }
    if (!(await bcrypt.compare(code, user.mfaEmailSetupCodeHash))) authFail('auth.mfa_invalid', 400);
    await this.store.updateUser(user.id, { ...MFA_RESET, mfaEnabled: true, mfaMethod: 'email' });
  }

  async disableMfa(userId: UserId, currentPassword: string): Promise<void> {
    const user = await this.requireUser(userId);
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) authFail('auth.wrong_password', 400);
    if (user.mfaEnabled) await this.store.updateUser(user.id, MFA_RESET);
  }
}
