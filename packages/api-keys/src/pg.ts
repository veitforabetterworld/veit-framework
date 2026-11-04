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
ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS key_enc TEXT;
`;

/** Column names of the store's table; the defaults are the ones of API_KEYS_SCHEMA_SQL. */
export type PgApiKeyColumns = {
  id: string;
  /** The owner: a user id, or e.g. an organization id. */
  owner: string;
  label: string;
  keyHash: string;
  prefix: string;
  /** TEXT[] */
  permissions: string;
  allResources: string;
  /** TEXT[] */
  resources: string;
  createdAt: string;
  lastUsedAt: string;
  revokedAt: string;
  /** null: the table has no encrypted copy, keys are not revealable. */
  keyEnc: string | null;
  /** Who created the key, when the owner is not a user; null: not stored. */
  createdBy: string | null;
  /** Mark of keys hashed with a former scheme (markLegacyHashedKeys from '@veit/api-keys/migrate'); NULL means the
   * current scheme. null: the table has no such column. */
  hashScheme: string | null;
};

export type PgApiKeyStoreOptions = {
  /** Default 'user_api_keys'; may carry a schema ('public.api_keys'). */
  table?: string;
  columns?: Partial<PgApiKeyColumns>;
};

const DEFAULT_COLUMNS: PgApiKeyColumns = {
  id: 'id',
  owner: 'user_id',
  label: 'label',
  keyHash: 'key_hash',
  prefix: 'key_prefix',
  permissions: 'permissions',
  allResources: 'all_resources',
  resources: 'resources',
  createdAt: 'created_at',
  lastUsedAt: 'last_used_at',
  revokedAt: 'revoked_at',
  keyEnc: 'key_enc',
  createdBy: null,
  hashScheme: null,
};

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** A quoted SQL identifier; throws on anything but plain names (they come from the host's code, not from users). */
export function quoteIdent(name: string): string {
  const parts = name.split('.');
  if (parts.length > 2 || !parts.every((p) => IDENT.test(p))) throw new Error(`api-keys: invalid identifier '${name}'`);
  return parts.map((p) => `"${p}"`).join('.');
}

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
  revealable: boolean;
  legacy_hash: boolean;
};

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
    revealable: row.revealable,
    legacyHash: row.legacy_hash,
  };
}

/** ApiKeyStore on Postgres. Table and column names are configurable, so a host keeps its existing table. */
export function createPgApiKeyStore(pool: Pool, options: PgApiKeyStoreOptions = {}): ApiKeyStore {
  const t = quoteIdent(options.table ?? 'user_api_keys');
  const names = { ...DEFAULT_COLUMNS, ...options.columns };
  const q = (name: string) => quoteIdent(name);
  const c = {
    id: q(names.id),
    owner: q(names.owner),
    label: q(names.label),
    keyHash: q(names.keyHash),
    prefix: q(names.prefix),
    permissions: q(names.permissions),
    allResources: q(names.allResources),
    resources: q(names.resources),
    createdAt: q(names.createdAt),
    lastUsedAt: q(names.lastUsedAt),
    revokedAt: q(names.revokedAt),
    keyEnc: names.keyEnc === null ? null : q(names.keyEnc),
    createdBy: names.createdBy === null ? null : q(names.createdBy),
    hashScheme: names.hashScheme === null ? null : q(names.hashScheme),
  };
  const selectColumns = `${c.id}::text AS id, ${c.owner}::text AS user_id, ${c.label} AS label, ${c.prefix} AS key_prefix,
    ${c.permissions} AS permissions, ${c.allResources} AS all_resources, ${c.resources} AS resources,
    ${c.createdAt} AS created_at, ${c.lastUsedAt} AS last_used_at, ${c.revokedAt} AS revoked_at,
    ${c.keyEnc ? `${c.keyEnc} IS NOT NULL` : 'false'} AS revealable,
    ${c.hashScheme ? `${c.hashScheme} IS NOT NULL` : 'false'} AS legacy_hash`;

  const store: ApiKeyStore = {
    async insert(input) {
      const columns = [c.owner, c.label, c.keyHash, c.prefix, c.permissions, c.allResources, c.resources];
      const values: unknown[] = [input.userId, input.label, input.keyHash, input.prefix, input.permissions, input.allResources, input.resources];
      if (c.keyEnc) {
        columns.push(c.keyEnc);
        values.push(input.keyEnc);
      }
      if (c.createdBy) {
        columns.push(c.createdBy);
        values.push(input.createdBy ?? input.userId);
      }
      const result = await pool.query<Row>(
        `INSERT INTO ${t} (${columns.join(', ')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')})
         RETURNING ${selectColumns}`,
        values,
      );
      return toRecord(result.rows[0])!;
    },

    async list(userId) {
      const result = await pool.query<Row>(
        `SELECT ${selectColumns} FROM ${t} WHERE ${c.owner} = $1 ORDER BY ${c.revokedAt} IS NOT NULL, ${c.createdAt} DESC`,
        [userId],
      );
      return result.rows.map((row) => toRecord(row)!);
    },

    async find(userId, id) {
      const result = await pool.query<Row>(`SELECT ${selectColumns} FROM ${t} WHERE ${c.owner} = $1 AND ${c.id}::text = $2`, [
        userId,
        id,
      ]);
      return toRecord(result.rows[0]);
    },

    async findByHash(keyHash) {
      const current = c.hashScheme ? ` AND ${c.hashScheme} IS NULL` : '';
      const result = await pool.query<Row>(
        `SELECT ${selectColumns} FROM ${t} WHERE ${c.keyHash} = $1 AND ${c.revokedAt} IS NULL${current}`,
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
      if (patch.label !== undefined) set(c.label, patch.label);
      if (patch.permissions !== undefined) set(c.permissions, patch.permissions);
      if (patch.allResources !== undefined) set(c.allResources, patch.allResources);
      if (patch.resources !== undefined) set(c.resources, patch.resources);
      if (sets.length === 0) return store.find(userId, id);
      const result = await pool.query<Row>(
        `UPDATE ${t} SET ${sets.join(', ')} WHERE ${c.owner} = $1 AND ${c.id}::text = $2 AND ${c.revokedAt} IS NULL
         RETURNING ${selectColumns}`,
        params,
      );
      return toRecord(result.rows[0]);
    },

    async revoke(userId, id) {
      const result = await pool.query(
        `UPDATE ${t} SET ${c.revokedAt} = NOW() WHERE ${c.owner} = $1 AND ${c.id}::text = $2 AND ${c.revokedAt} IS NULL`,
        [userId, id],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async touch(id) {
      await pool.query(`UPDATE ${t} SET ${c.lastUsedAt} = NOW() WHERE ${c.id}::text = $1`, [id]);
    },

    async addResource(id, resource) {
      await pool.query(
        `UPDATE ${t} SET ${c.resources} = array_append(${c.resources}, $2)
         WHERE ${c.id}::text = $1 AND NOT ${c.allResources} AND NOT ($2 = ANY(${c.resources}))`,
        [id, resource],
      );
    },

    async forgetResource(userId, resource) {
      await pool.query(`UPDATE ${t} SET ${c.resources} = array_remove(${c.resources}, $2) WHERE ${c.owner} = $1`, [
        userId,
        resource,
      ]);
    },
  };

  const keyEnc = c.keyEnc;
  if (keyEnc) {
    store.findKeyEnc = async (userId, id) => {
      const result = await pool.query<{ key_enc: string | null }>(
        `SELECT ${keyEnc} AS key_enc FROM ${t} WHERE ${c.owner} = $1 AND ${c.id}::text = $2 AND ${c.revokedAt} IS NULL`,
        [userId, id],
      );
      return result.rows[0]?.key_enc ?? null;
    };
  }

  const hashScheme = c.hashScheme;
  if (hashScheme) {
    store.findByLegacyHash = async (legacyHash) => {
      const result = await pool.query<Row>(
        `SELECT ${selectColumns} FROM ${t} WHERE ${c.keyHash} = $1 AND ${c.revokedAt} IS NULL AND ${hashScheme} IS NOT NULL`,
        [legacyHash],
      );
      return toRecord(result.rows[0]);
    };
    store.upgradeHash = async (id, keyHash) => {
      await pool.query(`UPDATE ${t} SET ${c.keyHash} = $2, ${hashScheme} = NULL WHERE ${c.id}::text = $1`, [id, keyHash]);
    };
  }

  return store;
}
