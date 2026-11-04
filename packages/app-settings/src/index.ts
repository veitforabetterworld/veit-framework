import { randomBytes } from 'node:crypto';
import type { SecretBox } from '@veit/secret-box';

/**
 * Admin settings in a key/value table (`app_settings` in all hosts). Secrets are stored in the format of
 * '@veit/secret-box' and never listed: listMasked reports only whether one is stored, reveal gives it to an admin on
 * request. Table and column names are configurable, so no host has to rename its table.
 */

type QueryResultLike = { rows: Record<string, unknown>[] };
/** pg's Pool#query or Client#query, or a function with the same call. */
export type SqlQuery = (text: string, params?: unknown[]) => Promise<QueryResultLike>;

export type AppSettingsOptions = {
  /** A pool (or anything with query). */
  pool?: { query: SqlQuery };
  /** Or the query function itself. */
  query?: SqlQuery;
  /** Default 'app_settings'; may carry a schema. */
  table?: string;
  /** Default 'key' (Plenivo: 'setting_key'). Must be unique (primary key). */
  keyColumn?: string;
  /** Default 'value' (Plenivo: 'setting_value'). */
  valueColumn?: string;
  /** Set to NOW() on every write; default 'updated_at', null when the table has none. */
  updatedAtColumn?: string | null;
  /** Encrypts the values of secretKeys. Required when secretKeys is not empty. */
  secretBox?: SecretBox;
  /** Keys whose values are secrets (SMTP password, client secrets, generated internal keys). */
  secretKeys?: readonly string[];
  /** Values of keys without a row. Not used for secrets. */
  defaults?: Readonly<Record<string, string>>;
  /** Clearing a value deletes its row (Plenivo). Default: the row keeps ''. */
  deleteEmpty?: boolean;
};

/** A value in listMasked: the text, or for a secret only whether one is stored. */
export type MaskedSettingValue = string | { stored: boolean };

export type AppSettings = {
  isSecret(key: string): boolean;
  /** The value (a secret decrypted), the default without a row, or null. Throws when a secret does not open. */
  get(key: string): Promise<string | null>;
  getMany(keys: readonly string[]): Promise<Record<string, string | null>>;
  /**
   * Stores a value; a secret is encrypted. For a secret, '' keeps the stored value (the admin form leaves the field
   * empty) and null clears it. For other keys null and '' both clear.
   */
  set(key: string, value: string | null): Promise<void>;
  setMany(values: Readonly<Record<string, string | null>>): Promise<void>;
  /** Values for the admin area: secrets as { stored }, never their value. Keys without row and default give ''. */
  listMasked(keys: readonly string[]): Promise<Record<string, MaskedSettingValue>>;
  /** A secret for an admin who asked to see it; '' when none is stored. Throws for keys that are not secrets. */
  reveal(key: string): Promise<string>;
  /** An internal secret created on first use (random, base64url) and kept from then on, e.g. a pepper. */
  ensureGenerated(key: string, bytes?: number): Promise<string>;
};

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteIdent(name: string): string {
  const parts = name.split('.');
  if (parts.length > 2 || !parts.every((p) => IDENT.test(p))) throw new Error(`app-settings: invalid identifier '${name}'`);
  return parts.map((p) => `"${p}"`).join('.');
}

export class AppSettingsError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly key?: string,
  ) {
    super(key ? `${code}: ${key}` : code);
    this.name = 'AppSettingsError';
  }
}

export function createAppSettings(options: AppSettingsOptions): AppSettings {
  const pool = options.pool;
  const query: SqlQuery | undefined = options.query ?? (pool ? (text, params) => pool.query(text, params) : undefined);
  if (!query) throw new Error('app-settings: pool or query is required');
  const secretKeys = new Set(options.secretKeys ?? []);
  const box = options.secretBox;
  if (secretKeys.size > 0 && !box) throw new Error('app-settings: secretKeys need a secretBox');
  const defaults = options.defaults ?? {};

  const t = quoteIdent(options.table ?? 'app_settings');
  const k = quoteIdent(options.keyColumn ?? 'key');
  const v = quoteIdent(options.valueColumn ?? 'value');
  const updatedAt = options.updatedAtColumn === null ? null : quoteIdent(options.updatedAtColumn ?? 'updated_at');
  const insertColumns = updatedAt ? `(${k}, ${v}, ${updatedAt}) VALUES ($1, $2, NOW())` : `(${k}, ${v}) VALUES ($1, $2)`;
  const updateSet = updatedAt ? `${v} = EXCLUDED.${v}, ${updatedAt} = NOW()` : `${v} = EXCLUDED.${v}`;

  const isSecret = (key: string) => secretKeys.has(key);

  async function readRaw(keys: readonly string[]): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    if (keys.length === 0) return map;
    const { rows } = await query!(`SELECT ${k} AS key, ${v} AS value FROM ${t} WHERE ${k} = ANY($1)`, [[...keys]]);
    for (const row of rows) map.set(String(row.key), row.value == null ? null : String(row.value));
    return map;
  }

  function open(key: string, raw: string): string {
    return isSecret(key) ? box!.decrypt(raw) : raw;
  }

  async function write(key: string, raw: string): Promise<void> {
    if (raw === '' && options.deleteEmpty) {
      await query!(`DELETE FROM ${t} WHERE ${k} = $1`, [key]);
      return;
    }
    await query!(`INSERT INTO ${t} ${insertColumns} ON CONFLICT (${k}) DO UPDATE SET ${updateSet}`, [key, raw]);
  }

  const settings: AppSettings = {
    isSecret,

    async get(key) {
      return (await settings.getMany([key]))[key];
    },

    async getMany(keys) {
      const raw = await readRaw(keys);
      const out: Record<string, string | null> = {};
      for (const key of keys) {
        const value = raw.get(key);
        if (value == null) out[key] = raw.has(key) || isSecret(key) ? null : (defaults[key] ?? null);
        else out[key] = open(key, value);
      }
      return out;
    },

    async set(key, value) {
      if (isSecret(key)) {
        if (value === '') return;
        await write(key, value === null ? '' : box!.encrypt(value));
        return;
      }
      await write(key, value ?? '');
    },

    async setMany(values) {
      for (const [key, value] of Object.entries(values)) await settings.set(key, value);
    },

    async listMasked(keys) {
      const raw = await readRaw(keys);
      const out: Record<string, MaskedSettingValue> = {};
      for (const key of keys) {
        const value = raw.get(key);
        out[key] = isSecret(key) ? { stored: Boolean(value) } : (value ?? (raw.has(key) ? '' : (defaults[key] ?? '')));
      }
      return out;
    },

    async reveal(key) {
      if (!isSecret(key)) throw new AppSettingsError('settings.not_secret', 400, key);
      return (await settings.get(key)) ?? '';
    },

    async ensureGenerated(key, bytes = 32) {
      const existing = await settings.get(key);
      if (existing) return existing;
      const fresh = randomBytes(bytes).toString('base64url');
      const stored = isSecret(key) ? box!.encrypt(fresh) : fresh;
      // Only an absent or empty row is filled: two processes starting at once keep the first value.
      await query!(
        `INSERT INTO ${t} ${insertColumns} ON CONFLICT (${k}) DO UPDATE SET ${updateSet} WHERE ${t}.${v} IS NULL OR ${t}.${v} = ''`,
        [key, stored],
      );
      const value = await settings.get(key);
      if (!value) throw new Error(`app-settings: could not store '${key}'`);
      return value;
    },
  };
  return settings;
}
