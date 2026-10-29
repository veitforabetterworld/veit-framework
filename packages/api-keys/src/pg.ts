import type { Pool } from 'pg';
import type { ApiKeyRecord, ApiKeyStore } from './index.js';

/** Table of createPgApiKeyStore; user_id refers to users(id) of '@veit/auth-server/pg'. Idempotent. */
export const API_KEYS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  permissions TEXT[] NOT NULL,
  all_resources BOOLEAN NOT NULL,
  resources TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS user_api_keys_user ON user_api_keys (user_id);
`;

type Row = {
  id: string;
  user_id: string;
  label: string;
  key_prefix: string;
  permissions: string[];
  all_resources: boolean;
  resources: string[];
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
};

const COLUMNS = `id::text, user_id::text, label, key_prefix, permissions, all_resources, resources, created_at,
  last_used_at, revoked_at`;

function toRecord(row: Row | undefined): ApiKeyRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    prefix: row.key_prefix,
    permissions: row.permissions,
    allResources: row.all_resources,
    resources: row.resources,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

export function createPgApiKeyStore(pool: Pool): ApiKeyStore {
  return {
    async insert(input) {
      const result = await pool.query<Row>(
        `INSERT INTO user_api_keys (user_id, label, key_hash, key_prefix, permissions, all_resources, resources)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUMNS}`,
        [input.userId, input.label, input.keyHash, input.prefix, input.permissions, input.allResources, input.resources],
      );
      return toRecord(result.rows[0])!;
    },

    async list(userId) {
      const result = await pool.query<Row>(
        `SELECT ${COLUMNS} FROM user_api_keys WHERE user_id = $1 ORDER BY revoked_at IS NOT NULL, created_at DESC`,
        [userId],
      );
      return result.rows.map((row) => toRecord(row)!);
    },

    async find(userId, id) {
      const result = await pool.query<Row>(`SELECT ${COLUMNS} FROM user_api_keys WHERE user_id = $1 AND id::text = $2`, [
        userId,
        id,
      ]);
      return toRecord(result.rows[0]);
    },

    async findByHash(keyHash) {
      const result = await pool.query<Row>(
        `SELECT ${COLUMNS} FROM user_api_keys WHERE key_hash = $1 AND revoked_at IS NULL`,
        [keyHash],
      );
      return toRecord(result.rows[0]);
    },

    async update(userId, id, patch) {
      const sets: string[] = [];
      const params: unknown[] = [userId, id];
      const set = (column: string, value: unknown) => {
        params.push(value);
        sets.push(`${column} = $${params.length}`);
      };
      if (patch.label !== undefined) set('label', patch.label);
      if (patch.permissions !== undefined) set('permissions', patch.permissions);
      if (patch.allResources !== undefined) set('all_resources', patch.allResources);
      if (patch.resources !== undefined) set('resources', patch.resources);
      if (sets.length === 0) return this.find(userId, id);
      const result = await pool.query<Row>(
        `UPDATE user_api_keys SET ${sets.join(', ')} WHERE user_id = $1 AND id::text = $2 AND revoked_at IS NULL
         RETURNING ${COLUMNS}`,
        params,
      );
      return toRecord(result.rows[0]);
    },

    async revoke(userId, id) {
      const result = await pool.query(
        `UPDATE user_api_keys SET revoked_at = NOW() WHERE user_id = $1 AND id::text = $2 AND revoked_at IS NULL`,
        [userId, id],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async touch(id) {
      await pool.query(`UPDATE user_api_keys SET last_used_at = NOW() WHERE id::text = $1`, [id]);
    },

    async addResource(id, resource) {
      await pool.query(
        `UPDATE user_api_keys SET resources = array_append(resources, $2)
         WHERE id::text = $1 AND NOT all_resources AND NOT ($2 = ANY(resources))`,
        [id, resource],
      );
    },

    async forgetResource(userId, resource) {
      await pool.query(`UPDATE user_api_keys SET resources = array_remove(resources, $2) WHERE user_id = $1`, [
        userId,
        resource,
      ]);
    },
  };
}
