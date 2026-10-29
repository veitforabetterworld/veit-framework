/**
 * Ports of the account logic. The host implements AuthStore against its own tables (or uses createPgAuthStore from
 * '@veit/auth-server/pg') and AuthMailer against its mail setup (or createSmtpMailer from '@veit/auth-server/smtp').
 */

export type UserId = string | number;

export type MfaMethod = 'totp' | 'email';

export type AuthUserRecord = {
  id: UserId;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  emailVerificationToken: string | null;
  emailVerificationExpiresAt: Date | null;
  mfaEnabled: boolean;
  mfaMethod: MfaMethod | null;
  mfaTotpSecretEnc: string | null;
  mfaTotpSetupSecretEnc: string | null;
  mfaTotpSetupExpiresAt: Date | null;
  mfaEmailSetupCodeHash: string | null;
  mfaEmailSetupExpiresAt: Date | null;
  createdAt: Date;
};

/** Fields a store writes; never id or createdAt. */
export type AuthUserPatch = Partial<Omit<AuthUserRecord, 'id' | 'createdAt'>>;

export type NewAuthUser = Pick<
  AuthUserRecord,
  'email' | 'firstName' | 'lastName' | 'passwordHash' | 'emailVerificationToken' | 'emailVerificationExpiresAt'
>;

export type SessionRecord = {
  id: UserId;
  loginTime: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  deviceName: string | null;
  isCurrent: boolean;
};

export type NewSession = {
  userId: UserId;
  /** The cookie value; the store decides whether it keeps it hashed. */
  token: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  deviceName: string | null;
};

export type MfaChallengeRecord = {
  id: UserId;
  userId: UserId;
  expiresAt: Date;
  emailOtpHash: string | null;
  emailOtpExpiresAt: Date | null;
  emailSendCount: number;
  lastEmailSentAt: Date | null;
  passwordInsecure: boolean;
  passwordSecurityReasons: string[];
};

export type PasswordResetRecord = { id: UserId; userId: UserId | null };

export interface AuthStore {
  findUserById(id: UserId): Promise<AuthUserRecord | null>;
  /** emailNorm is trimmed and lower case; deleted users are not found. */
  findUserByEmail(emailNorm: string): Promise<AuthUserRecord | null>;
  findUserByVerificationToken(token: string): Promise<AuthUserRecord | null>;
  insertUser(user: NewAuthUser): Promise<UserId>;
  updateUser(id: UserId, patch: AuthUserPatch): Promise<void>;
  /** Removes the user (hard or soft, the host decides) together with its sessions and challenges. */
  deleteUser(id: UserId): Promise<void>;

  createSession(session: NewSession): Promise<void>;
  /** The user of a valid (not revoked, not expired) session, or null. */
  findSessionUser(token: string): Promise<AuthUserRecord | null>;
  /** Sets last_used_at; called at most every few minutes per session. */
  touchSession(token: string): Promise<void>;
  listSessions(userId: UserId, currentToken: string | null): Promise<SessionRecord[]>;
  revokeSession(userId: UserId, sessionId: UserId): Promise<boolean>;
  revokeSessionByToken(token: string): Promise<void>;
  revokeAllSessions(userId: UserId): Promise<void>;

  /** Replaces any open challenge of the user. tokenHash is sha256 hex of the token handed to the client. */
  createMfaChallenge(input: {
    userId: UserId;
    tokenHash: string;
    expiresAt: Date;
    passwordInsecure: boolean;
    passwordSecurityReasons: string[];
  }): Promise<void>;
  findMfaChallenge(tokenHash: string): Promise<MfaChallengeRecord | null>;
  updateMfaChallenge(
    id: UserId,
    patch: { emailOtpHash: string; emailOtpExpiresAt: Date; emailSendCount: number; lastEmailSentAt: Date },
  ): Promise<void>;
  deleteMfaChallenges(userId: UserId): Promise<void>;

  countPasswordResets(emailHash: string, since: Date): Promise<number>;
  insertPasswordReset(input: {
    userId: UserId | null;
    emailHash: string;
    tokenHash: string;
    expiresAt: Date;
    requestIp: string | null;
  }): Promise<void>;
  /** An unused, unexpired reset. */
  findPasswordReset(tokenHash: string): Promise<PasswordResetRecord | null>;
  markPasswordResetUsed(id: UserId): Promise<void>;

  /** Drops expired sessions, challenges, resets and stale verification tokens. */
  purgeExpired(): Promise<void>;
}

export type MailTo = { to: string };

export interface AuthMailer {
  sendVerification(input: MailTo & { token: string; url: string }): Promise<void>;
  sendPasswordReset(input: MailTo & { token: string; url: string }): Promise<void>;
  sendMfaLoginCode(input: MailTo & { code: string }): Promise<void>;
  sendMfaSetupCode(input: MailTo & { code: string }): Promise<void>;
}

/** Encrypts TOTP secrets at rest; see createAesGcmSecretBox. */
export interface SecretBox {
  encrypt(plain: string): string;
  /** '' when the value cannot be decrypted. */
  decrypt(stored: string): string;
}

/** What the transport knows about the request. */
export type RequestInfo = {
  ip: string | null;
  userAgent: string | null;
  /** Public origin of the web app, for links in mails (https://example.org). */
  origin: string;
  /** Optional label of the client, e.g. 'App'. */
  deviceName?: string | null;
};
