import { createHash } from 'node:crypto';
import { SECRET_BOX_PREFIX, deriveSecretBoxKey, openAesGcm, parseCanonical, type SecretBox } from './index.js';

/**
 * One-time data migrations onto the canonical format of '@veit/secret-box'. Runtime code must not import this:
 * the decoders here read the layouts that hosts used before, so that a migration can convert stored values once.
 */

/** A layout a stored value may still have. decodeLegacy tries them in the given order. */
export type LegacySource =
  /** Base64 of {"iv","tag","d"} without prefix, key sha256(`${key}|${context}`) with the material untrimmed: the old
   * createAesGcmSecretBox of '@veit/auth-server' (TOTP secrets in all hosts, all Plenivo secrets). */
  | { kind: 'auth-json'; key: string; context: string }
  /** `iv.tag.data` in base64url, key sha256(secret): the old encryptApiKey of '@veit/api-keys' (key_enc). */
  | { kind: 'compact-sha256'; secret: string }
  /** `iv.tag.data` in base64url, the key itself as 64 hex digits: Scangut's encryptValue. */
  | { kind: 'compact-raw-hex'; keyHex: string }
  /** `enc1:` with a different key material or context, e.g. when a host moves values to a new context. */
  | { kind: 'canonical'; key: string; context: string }
  /** The value is the plain secret. Values that look like ciphertext of a known layout are refused, so an unknown key
   * never turns ciphertext into a "secret". Put it last. */
  | { kind: 'plaintext' };

export class LegacyDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LegacyDecodeError';
  }
}

type Payload = { iv: Buffer; tag: Buffer; data: Buffer };

function parseAuthJson(stored: string): Payload | null {
  if (stored.startsWith(SECRET_BOX_PREFIX)) return null;
  try {
    const json = JSON.parse(Buffer.from(stored, 'base64').toString('utf8')) as unknown;
    if (typeof json !== 'object' || json === null) return null;
    const { iv, tag, d } = json as Record<string, unknown>;
    if (typeof iv !== 'string' || typeof tag !== 'string' || typeof d !== 'string') return null;
    const payload = { iv: Buffer.from(iv, 'base64'), tag: Buffer.from(tag, 'base64'), data: Buffer.from(d, 'base64') };
    return payload.iv.length === 12 && payload.tag.length === 16 ? payload : null;
  } catch {
    return null;
  }
}

const BASE64URL = /^[A-Za-z0-9_-]*$/;

function parseCompact(stored: string): Payload | null {
  const parts = stored.split('.');
  if (parts.length !== 3 || !parts.every((p) => BASE64URL.test(p)) || !parts[0] || !parts[1]) return null;
  const [iv, tag, data] = parts.map((p) => Buffer.from(p, 'base64url'));
  return iv.length === 12 && tag.length === 16 ? { iv, tag, data } : null;
}

/** Whether the value has one of the encrypted layouts above (then the plaintext source refuses it). Anything with the
 * `enc1:` prefix counts, even when damaged: it was meant to be ciphertext and must fail the migration, not become a
 * "secret". */
export function looksEncrypted(stored: string): boolean {
  return (
    stored.startsWith(SECRET_BOX_PREFIX) ||
    parseCanonical(stored) !== null ||
    parseAuthJson(stored) !== null ||
    parseCompact(stored) !== null
  );
}

function tryOpen(key: Buffer, payload: Payload | null): string | null {
  if (!payload) return null;
  try {
    return openAesGcm(key, payload);
  } catch {
    return null;
  }
}

function decodeWith(stored: string, source: LegacySource): string | null {
  switch (source.kind) {
    case 'auth-json':
      return tryOpen(createHash('sha256').update(`${source.key}|${source.context}`, 'utf8').digest(), parseAuthJson(stored));
    case 'compact-sha256':
      return tryOpen(createHash('sha256').update(source.secret, 'utf8').digest(), parseCompact(stored));
    case 'compact-raw-hex': {
      const key = Buffer.from(source.keyHex.trim(), 'hex');
      if (key.length !== 32) throw new LegacyDecodeError('compact-raw-hex: keyHex must be 64 hex digits');
      return tryOpen(key, parseCompact(stored));
    }
    case 'canonical':
      return tryOpen(deriveSecretBoxKey(source.key.trim(), source.context), parseCanonical(stored));
    case 'plaintext':
      return looksEncrypted(stored) ? null : stored;
  }
}

/** The plain value of a stored value in one of the given layouts; '' stays ''. Throws when no source opens it. */
export function decodeLegacy(stored: string, sources: readonly LegacySource[]): string {
  if (stored === '') return '';
  for (const source of sources) {
    const plain = decodeWith(stored, source);
    if (plain !== null) return plain;
  }
  throw new LegacyDecodeError(`no source opens the value (tried ${sources.map((s) => s.kind).join(', ') || 'nothing'})`);
}

/** Whether the box opens the value, i.e. it needs no migration. */
export function isCanonicalFor(box: SecretBox, stored: string): boolean {
  if (!box.isEncrypted(stored)) return false;
  try {
    box.decrypt(stored);
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------------------------------------ rows

type QueryResultLike = { rows: Record<string, unknown>[] };
/** One connection: pg's Client or PoolClient, or a function with the same call. */
export type SqlQuery = (text: string, params?: unknown[]) => Promise<QueryResultLike>;
export type SqlClient = { query: SqlQuery };
export type SqlPool = { connect(): Promise<SqlClient & { release(): void }> };

export type ReencryptRowsOptions = {
  /** A pool: the migration takes one connection for its transaction. */
  pool?: SqlPool;
  /** Or one connection (Client/PoolClient), or its query function. Not a pool's query: BEGIN and COMMIT must run on
   * the same connection. */
  client?: SqlClient | SqlQuery;
  /** Table, optionally with schema ('public.users'). */
  table: string;
  idColumn: string;
  column: string;
  /** The box of the new, canonical values. */
  box: SecretBox;
  /** Layouts the stored values may have; see LegacySource. */
  sources: readonly LegacySource[];
  /** Extra SQL condition, e.g. `mfa_enabled`. Only the host's own SQL, never user input. */
  where?: string;
  params?: unknown[];
  /** Top-level fields of a JSON/JSONB column that hold secrets; the column itself is then JSON, not a secret. */
  jsonFields?: readonly string[];
  /** Counts only, rolls back. */
  dryRun?: boolean;
  /** Commits the converted rows even though some failed. Default false: one failure rolls everything back. */
  allowFailures?: boolean;
};

export type ReencryptResult = {
  converted: number;
  alreadyCanonical: number;
  empty: number;
  failed: { id: string; field?: string; error: string }[];
  committed: boolean;
};

export class ReencryptError extends Error {
  constructor(readonly result: ReencryptResult) {
    super(`reencryptRows: ${result.failed.length} value(s) could not be decoded; nothing was committed`);
    this.name = 'ReencryptError';
  }
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteIdent(name: string): string {
  const parts = name.split('.');
  if (parts.length > 2 || !parts.every((p) => IDENT.test(p))) throw new Error(`reencryptRows: invalid identifier '${name}'`);
  return parts.map((p) => `"${p}"`).join('.');
}

type Outcome = { kind: 'empty' } | { kind: 'canonical' } | { kind: 'converted'; value: string } | { kind: 'failed'; error: string };

function convert(value: string, box: SecretBox, sources: readonly LegacySource[]): Outcome {
  if (value === '') return { kind: 'empty' };
  if (isCanonicalFor(box, value)) return { kind: 'canonical' };
  try {
    return { kind: 'converted', value: box.encrypt(decodeLegacy(value, sources)) };
  } catch (error) {
    return { kind: 'failed', error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Converts the secrets of one column to the canonical format in a single transaction: values the box already opens
 * stay, the others are decoded with `sources` and encrypted with `box`. If any value fails, nothing is committed and
 * ReencryptError is thrown (its `result` names the rows), unless allowFailures is set. Run it once per column, e.g.
 * in the host's migration, before the runtime code reads the column with the box.
 */
export async function reencryptRows(options: ReencryptRowsOptions): Promise<ReencryptResult> {
  const table = quoteIdent(options.table);
  const id = quoteIdent(options.idColumn);
  const column = quoteIdent(options.column);
  if (!options.pool && !options.client) throw new Error('reencryptRows: pool or client is required');
  if (!options.box.enabled()) throw new Error('reencryptRows: the target box has no key material');

  let release = () => {};
  let query: SqlQuery;
  if (options.client) {
    const client = options.client;
    query = typeof client === 'function' ? client : (text, params) => client.query(text, params);
  } else {
    const conn = await options.pool!.connect();
    release = () => conn.release();
    query = (text, params) => conn.query(text, params);
  }

  const result: ReencryptResult = { converted: 0, alreadyCanonical: 0, empty: 0, failed: [], committed: false };
  try {
    await query('BEGIN');
    try {
      const where = options.where ? ` AND (${options.where})` : '';
      const { rows } = await query(
        `SELECT ${id}::text AS id, ${column} AS value FROM ${table} WHERE ${column} IS NOT NULL${where} FOR UPDATE`,
        options.params ?? [],
      );
      const updates: { id: string; value: string }[] = [];
      for (const row of rows) {
        const rowId = String(row.id);
        if (options.jsonFields) {
          const raw = row.value;
          let doc: Record<string, unknown>;
          try {
            doc = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>;
          } catch {
            result.failed.push({ id: rowId, error: 'not JSON' });
            continue;
          }
          if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) continue;
          let changed = false;
          const next = { ...doc };
          for (const field of options.jsonFields) {
            const value = doc[field];
            if (typeof value !== 'string') continue;
            const outcome = convert(value, options.box, options.sources);
            if (outcome.kind === 'empty') result.empty++;
            else if (outcome.kind === 'canonical') result.alreadyCanonical++;
            else if (outcome.kind === 'failed') result.failed.push({ id: rowId, field, error: outcome.error });
            else {
              result.converted++;
              next[field] = outcome.value;
              changed = true;
            }
          }
          if (changed) updates.push({ id: rowId, value: JSON.stringify(next) });
        } else {
          const outcome = convert(String(row.value), options.box, options.sources);
          if (outcome.kind === 'empty') result.empty++;
          else if (outcome.kind === 'canonical') result.alreadyCanonical++;
          else if (outcome.kind === 'failed') result.failed.push({ id: rowId, error: outcome.error });
          else {
            result.converted++;
            updates.push({ id: rowId, value: outcome.value });
          }
        }
      }
      if (options.dryRun || (result.failed.length > 0 && !options.allowFailures)) {
        await query('ROLLBACK');
      } else {
        for (const update of updates) {
          await query(`UPDATE ${table} SET ${column} = $2 WHERE ${id}::text = $1`, [update.id, update.value]);
        }
        await query('COMMIT');
        result.committed = true;
      }
    } catch (error) {
      await query('ROLLBACK').catch(() => {});
      throw error;
    }
  } finally {
    release();
  }
  if (result.failed.length > 0 && !options.allowFailures && !options.dryRun) throw new ReencryptError(result);
  return result;
}
