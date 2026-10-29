import type { Pool } from 'pg';
import { sha256hex } from './service.js';
import type {
  AuthStore,
  AuthUserPatch,
  AuthUserRecord,
  MfaChallengeRecord,
  NewAuthUser,
  SessionRecord,
  UserId,
} from './types.js';

/**
 * Tables of createPgAuthStore. Hosts copy this into a migration (it is idempotent) and may add their own columns to
 * users (e.g. is_admin). Session cookies are stored as sha256, never in plain text.
 */
export const AUTH_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  email_verification_token TEXT,
  email_verification_expires_at TIMESTAMPTZ,
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  mfa_method TEXT CHECK (mfa_method IN ('totp', 'email')),
  mfa_totp_secret_enc TEXT,
  mfa_totp_setup_secret_enc TEXT,
  mfa_totp_setup_expires_at TIMESTAMPTZ,
  mfa_email_setup_code_hash TEXT,
  mfa_email_setup_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_verification_token_key ON users (email_verification_token)
  WHERE email_verification_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  device_name TEXT
);
CREATE INDEX IF NOT EXISTS user_sessions_user ON user_sessions (user_id);

CREATE TABLE IF NOT EXISTS user_mfa_challenges (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  email_otp_hash TEXT,
  email_otp_expires_at TIMESTAMPTZ,
  email_send_count INTEGER NOT NULL DEFAULT 0,
  last_email_sent_at TIMESTAMPTZ,
  password_insecure BOOLEAN NOT NULL DEFAULT false,
  password_security_reasons TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS user_password_resets (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  email_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  request_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_password_resets_email ON user_password_resets (email_hash, created_at);
`;

const USER_COLUMNS: Record<keyof AuthUserPatch, string> = {
  email: 'email',
  firstName: 'first_name',
  lastName: 'last_name',
  passwordHash: 'password_hash',
  emailVerifiedAt: 'email_verified_at',
  emailVerificationToken: 'email_verification_token',
  emailVerificationExpiresAt: 'email_verification_expires_at',
  mfaEnabled: 'mfa_enabled',
  mfaMethod: 'mfa_method',
  mfaTotpSecretEnc: 'mfa_totp_secret_enc',
  mfaTotpSetupSecretEnc: 'mfa_totp_setup_secret_enc',
  mfaTotpSetupExpiresAt: 'mfa_totp_setup_expires_at',
  mfaEmailSetupCodeHash: 'mfa_email_setup_code_hash',
  mfaEmailSetupExpiresAt: 'mfa_email_setup_expires_at',
};

const USER_SELECT = `u.id::text AS id, u.email, u.first_name, u.last_name, u.password_hash, u.email_verified_at,
  u.email_verification_token, u.email_verification_expires_at, u.mfa_enabled, u.mfa_method, u.mfa_totp_secret_enc,
  u.mfa_totp_setup_secret_enc, u.mfa_totp_setup_expires_at, u.mfa_email_setup_code_hash,
  u.mfa_email_setup_expires_at, u.created_at`;

type UserRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  email_verified_at: Date | null;
  email_verification_token: string | null;
  email_verification_expires_at: Date | null;
  mfa_enabled: boolean;
  mfa_method: 'totp' | 'email' | null;
  mfa_totp_secret_enc: string | null;
  mfa_totp_setup_secret_enc: string | null;
  mfa_totp_setup_expires_at: Date | null;
  mfa_email_setup_code_hash: string | null;
  mfa_email_setup_expires_at: Date | null;
  created_at: Date;
};

function toUser(row: UserRow | undefined): AuthUserRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    passwordHash: row.password_hash,
    emailVerifiedAt: row.email_verified_at,
    emailVerificationToken: row.email_verification_token,
    emailVerificationExpiresAt: row.email_verification_expires_at,
    mfaEnabled: row.mfa_enabled,
    mfaMethod: row.mfa_method,
    mfaTotpSecretEnc: row.mfa_totp_secret_enc,
    mfaTotpSetupSecretEnc: row.mfa_totp_setup_secret_enc,
    mfaTotpSetupExpiresAt: row.mfa_totp_setup_expires_at,
    mfaEmailSetupCodeHash: row.mfa_email_setup_code_hash,
    mfaEmailSetupExpiresAt: row.mfa_email_setup_expires_at,
    createdAt: row.created_at,
  };
}

/** AuthStore on the tables of AUTH_SCHEMA_SQL. */
export function createPgAuthStore(pool: Pool): AuthStore {
  const one = async (sql: string, params: unknown[]) => toUser((await pool.query<UserRow>(sql, params)).rows[0]);

  return {
    findUserById: (id: UserId) => one(`SELECT ${USER_SELECT} FROM users u WHERE u.id = $1`, [id]),
    findUserByEmail: (email: string) => one(`SELECT ${USER_SELECT} FROM users u WHERE lower(u.email) = $1`, [email]),
    findUserByVerificationToken: (token: string) =>
      one(`SELECT ${USER_SELECT} FROM users u WHERE u.email_verification_token = $1`, [token]),

    async insertUser(user: NewAuthUser) {
      const result = await pool.query<{ id: string }>(
        `INSERT INTO users (email, first_name, last_name, password_hash, email_verification_token,
                            email_verification_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id::text`,
        [user.email, user.firstName, user.lastName, user.passwordHash, user.emailVerificationToken, user.emailVerificationExpiresAt],
      );
      return result.rows[0].id;
    },

    async updateUser(id, patch) {
      const entries = Object.entries(patch).filter(([, value]) => value !== undefined) as Array<[keyof AuthUserPatch, unknown]>;
      if (entries.length === 0) return;
      const sets = entries.map(([key], index) => `${USER_COLUMNS[key]} = $${index + 2}`);
      await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $1`, [id, ...entries.map(([, value]) => value)]);
    },

    async deleteUser(id) {
      await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
    },

    async createSession(session) {
      await pool.query(
        `INSERT INTO user_sessions (user_id, token_hash, last_used_at, expires_at, ip_address, user_agent, device_name)
         VALUES ($1, $2, NOW(), $3, $4, $5, $6)`,
        [session.userId, sha256hex(session.token), session.expiresAt, session.ipAddress, session.userAgent, session.deviceName],
      );
    },

    findSessionUser: (token: string) =>
      one(
        `SELECT ${USER_SELECT} FROM user_sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()`,
        [sha256hex(token)],
      ),

    async touchSession(token) {
      await pool.query(`UPDATE user_sessions SET last_used_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`, [
        sha256hex(token),
      ]);
    },

    async listSessions(userId, currentToken) {
      const current = currentToken ? sha256hex(currentToken) : '';
      const result = await pool.query<{
        id: string;
        login_time: Date;
        last_used_at: Date | null;
        expires_at: Date;
        ip_address: string | null;
        user_agent: string | null;
        device_name: string | null;
        is_current: boolean;
      }>(
        `SELECT id::text, login_time, last_used_at, expires_at, ip_address, user_agent, device_name,
                token_hash = $2 AS is_current
         FROM user_sessions
         WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
         ORDER BY coalesce(last_used_at, login_time) DESC`,
        [userId, current],
      );
      return result.rows.map(
        (row): SessionRecord => ({
          id: row.id,
          loginTime: row.login_time,
          lastUsedAt: row.last_used_at,
          expiresAt: row.expires_at,
          ipAddress: row.ip_address,
          userAgent: row.user_agent,
          deviceName: row.device_name,
          isCurrent: row.is_current,
        }),
      );
    },

    async revokeSession(userId, sessionId) {
      const result = await pool.query(
        `UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
        [sessionId, userId],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async revokeSessionByToken(token) {
      await pool.query(`UPDATE user_sessions SET revoked_at = NOW() WHERE token_hash = $1`, [sha256hex(token)]);
    },

    async revokeAllSessions(userId) {
      await pool.query(`UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
    },

    async createMfaChallenge(input) {
      await pool.query(`DELETE FROM user_mfa_challenges WHERE user_id = $1`, [input.userId]);
      await pool.query(
        `INSERT INTO user_mfa_challenges (user_id, token_hash, expires_at, password_insecure, password_security_reasons)
         VALUES ($1, $2, $3, $4, $5)`,
        [input.userId, input.tokenHash, input.expiresAt, input.passwordInsecure, input.passwordSecurityReasons],
      );
    },

    async findMfaChallenge(tokenHash) {
      const result = await pool.query<{
        id: string;
        user_id: string;
        expires_at: Date;
        email_otp_hash: string | null;
        email_otp_expires_at: Date | null;
        email_send_count: number;
        last_email_sent_at: Date | null;
        password_insecure: boolean;
        password_security_reasons: string[];
      }>(
        `SELECT id::text, user_id::text, expires_at, email_otp_hash, email_otp_expires_at, email_send_count,
                last_email_sent_at, password_insecure, password_security_reasons
         FROM user_mfa_challenges WHERE token_hash = $1 AND expires_at > NOW()`,
        [tokenHash],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        id: row.id,
        userId: row.user_id,
        expiresAt: row.expires_at,
        emailOtpHash: row.email_otp_hash,
        emailOtpExpiresAt: row.email_otp_expires_at,
        emailSendCount: row.email_send_count,
        lastEmailSentAt: row.last_email_sent_at,
        passwordInsecure: row.password_insecure,
        passwordSecurityReasons: row.password_security_reasons,
      } satisfies MfaChallengeRecord;
    },

    async updateMfaChallenge(id, patch) {
      await pool.query(
        `UPDATE user_mfa_challenges SET email_otp_hash = $2, email_otp_expires_at = $3, email_send_count = $4,
                last_email_sent_at = $5 WHERE id = $1`,
        [id, patch.emailOtpHash, patch.emailOtpExpiresAt, patch.emailSendCount, patch.lastEmailSentAt],
      );
    },

    async deleteMfaChallenges(userId) {
      await pool.query(`DELETE FROM user_mfa_challenges WHERE user_id = $1`, [userId]);
    },

    async countPasswordResets(emailHash, since) {
      const result = await pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM user_password_resets WHERE email_hash = $1 AND created_at > $2`,
        [emailHash, since],
      );
      return Number(result.rows[0]?.n ?? 0);
    },

    async insertPasswordReset(input) {
      await pool.query(
        `INSERT INTO user_password_resets (user_id, email_hash, token_hash, expires_at, request_ip)
         VALUES ($1, $2, $3, $4, $5)`,
        [input.userId, input.emailHash, input.tokenHash, input.expiresAt, input.requestIp],
      );
    },

    async findPasswordReset(tokenHash) {
      const result = await pool.query<{ id: string; user_id: string | null }>(
        `SELECT id::text, user_id::text FROM user_password_resets
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
        [tokenHash],
      );
      const row = result.rows[0];
      return row ? { id: row.id, userId: row.user_id } : null;
    },

    async markPasswordResetUsed(id) {
      await pool.query(`UPDATE user_password_resets SET used_at = NOW() WHERE id = $1`, [id]);
    },

    async purgeExpired() {
      await pool.query(`DELETE FROM user_sessions WHERE expires_at < NOW() - INTERVAL '1 day'`);
      await pool.query(`DELETE FROM user_mfa_challenges WHERE expires_at < NOW()`);
      await pool.query(`DELETE FROM user_password_resets WHERE expires_at < NOW() - INTERVAL '2 days'`);
    },
  };
}
