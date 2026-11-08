import type { Pool } from 'pg';
import type { UserId, WebPushStore, WebPushSubscriptionRecord } from './index.js';

/**
 * Tables of createPgWebPushStore; user_id refers to users(id) of '@veit/auth-server/pg', so deleting an account
 * removes its subscriptions. Idempotent: the host runs it with its migrations.
 */
export const WEB_PUSH_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS web_push_subscriptions_user ON web_push_subscriptions (user_id);
CREATE TABLE IF NOT EXISTS web_push_preferences (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

type Row = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: Date;
  last_success_at: Date | null;
  last_failure_at: Date | null;
};

const COLUMNS = `id::text, user_id::text, endpoint, p256dh, auth, user_agent, created_at, last_success_at, last_failure_at`;

function toRecord(row: Row): WebPushSubscriptionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    lastSuccessAt: row.last_success_at,
    lastFailureAt: row.last_failure_at,
  };
}

/** WebPushStore on Postgres (tables of WEB_PUSH_SCHEMA_SQL). */
export function createPgWebPushStore(pool: Pick<Pool, 'query'>): WebPushStore {
  return {
    async upsert(userId: UserId, input, userAgent) {
      const result = await pool.query<Row>(
        `INSERT INTO web_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent
         RETURNING ${COLUMNS}`,
        [userId, input.endpoint, input.keys.p256dh, input.keys.auth, userAgent],
      );
      return toRecord(result.rows[0]);
    },
    async remove(userId, endpoint) {
      const result = await pool.query(`DELETE FROM web_push_subscriptions WHERE user_id = $1 AND endpoint = $2`, [
        userId,
        endpoint,
      ]);
      return (result.rowCount ?? 0) > 0;
    },
    async removeById(id) {
      await pool.query(`DELETE FROM web_push_subscriptions WHERE id = $1`, [id]);
    },
    async list(userId) {
      const result = await pool.query<Row>(
        `SELECT ${COLUMNS} FROM web_push_subscriptions WHERE user_id = $1 ORDER BY created_at`,
        [userId],
      );
      return result.rows.map(toRecord);
    },
    async markResult(id, ok) {
      await pool.query(
        ok
          ? `UPDATE web_push_subscriptions SET last_success_at = NOW() WHERE id = $1`
          : `UPDATE web_push_subscriptions SET last_failure_at = NOW() WHERE id = $1`,
        [id],
      );
    },
    async isEnabled(userId) {
      const result = await pool.query<{ enabled: boolean }>(`SELECT enabled FROM web_push_preferences WHERE user_id = $1`, [
        userId,
      ]);
      return result.rows[0]?.enabled ?? true;
    },
    async setEnabled(userId, enabled) {
      await pool.query(
        `INSERT INTO web_push_preferences (user_id, enabled) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()`,
        [userId, enabled],
      );
    },
  };
}
