import { createHash } from 'node:crypto';
import { createSecretBox } from '@veit/secret-box';
import { reencryptRows, type ReencryptResult, type SqlClient, type SqlPool, type SqlQuery } from '@veit/secret-box/migrate';
import { API_KEYS_SECRET_CONTEXT } from './index.js';
import { quoteIdent } from './pg.js';

/**
 * One-time migrations onto '@veit/api-keys'. Not for runtime code, except legacySha256Hash during a hash transition
 * (see the `legacyHash` option of ApiKeyService).
 */

/** sha256(key) in hex, without pepper: the scheme of keys created before the move (e.g. Plenivo's api_keys). */
export function legacySha256Hash(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

type Db = { pool?: SqlPool; client?: SqlClient | SqlQuery };

async function withTransaction<T>(db: Db, fn: (query: SqlQuery) => Promise<T>): Promise<T> {
  let release = () => {};
  let query: SqlQuery;
  if (db.client) {
    const client = db.client;
    query = typeof client === 'function' ? client : (text, params) => client.query(text, params);
  } else if (db.pool) {
    const conn = await db.pool.connect();
    release = () => conn.release();
    query = (text, params) => conn.query(text, params);
  } else {
    throw new Error('api-keys migrate: pool or client is required');
  }
  try {
    await query('BEGIN');
    try {
      const result = await fn(query);
      await query('COMMIT');
      return result;
    } catch (error) {
      await query('ROLLBACK').catch(() => {});
      throw error;
    }
  } finally {
    release();
  }
}

export type MarkLegacyHashedKeysOptions = Db & {
  /** The host's key table, e.g. 'api_keys'. */
  table: string;
  /** Column that marks the former scheme; default 'hash_scheme'. Pass the same name as `columns.hashScheme` of
   * createPgApiKeyStore. */
  column?: string;
  /** Value of the mark; default 'sha256'. */
  scheme?: string;
};

/**
 * Prepares a host's existing key table for the hash transition: adds the mark column and marks every existing key
 * with the former scheme. Runs only while the column does not exist yet, so a second run can never mark keys created
 * with the current scheme. Returns how many keys were marked (0 when the column already existed).
 */
export async function markLegacyHashedKeys(options: MarkLegacyHashedKeysOptions): Promise<{ marked: number; alreadyPrepared: boolean }> {
  const [schema, name] = options.table.includes('.') ? options.table.split('.') : [null, options.table];
  const table = quoteIdent(options.table);
  const column = quoteIdent(options.column ?? 'hash_scheme');
  return withTransaction(options, async (query) => {
    const exists = await query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = COALESCE($1, current_schema()) AND table_name = $2 AND column_name = $3`,
      [schema, name, options.column ?? 'hash_scheme'],
    );
    if (exists.rows.length > 0) return { marked: 0, alreadyPrepared: true };
    await query(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT`);
    const marked = await query(`UPDATE ${table} SET ${column} = $1 RETURNING 1`, [options.scheme ?? 'sha256']);
    return { marked: marked.rows.length, alreadyPrepared: false };
  });
}

export type ReencryptApiKeysOptions = Db & {
  /** The `secret` the keys were encrypted with by the old encryptApiKey (`iv.tag.data`, key sha256(secret)). */
  oldSecret: string;
  /** The `secret` the service uses from now on; default oldSecret. */
  secret?: string;
  /** Default API_KEYS_SECRET_CONTEXT. */
  secretContext?: string;
  table?: string;
  idColumn?: string;
  column?: string;
  dryRun?: boolean;
};

/**
 * Converts key_enc from the old encryptApiKey layout to '@veit/secret-box' once. A key that cannot be opened (e.g.
 * the secret changed since) fails the whole run; set its key_enc to NULL first if it should just stop being
 * revealable.
 */
export function reencryptApiKeys(options: ReencryptApiKeysOptions): Promise<ReencryptResult> {
  return reencryptRows({
    pool: options.pool,
    client: options.client,
    table: options.table ?? 'user_api_keys',
    idColumn: options.idColumn ?? 'id',
    column: options.column ?? 'key_enc',
    box: createSecretBox({ key: options.secret ?? options.oldSecret, context: options.secretContext ?? API_KEYS_SECRET_CONTEXT }),
    sources: [{ kind: 'compact-sha256', secret: options.oldSecret }],
    dryRun: options.dryRun,
  });
}
