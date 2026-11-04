import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

/**
 * Liest `DATABASE_URL` aus der Umgebung.
 * @param fallback Nur für lokale Defaults (z. B. Tests); in Produktion lieber immer explizit setzen.
 */
export function getDatabaseUrl(fallback?: string): string {
  const url = process.env.DATABASE_URL ?? fallback;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return url;
}

/** Pool-Optionen von `pg`, die Hosts setzen; ohne Angabe gelten die Defaults von `pg`. */
export type VeitPoolOptions = {
  connectionString?: string;
  fallbackUrl?: string;
  /** Maximale Zahl gleichzeitiger Verbindungen (pg-Default 10). */
  max?: number;
  /** Leerlaufzeit, nach der eine Verbindung geschlossen wird, in ms (pg-Default 10000). */
  idleTimeoutMillis?: number;
  /** Wartezeit auf eine Verbindung in ms; 0 wartet unbegrenzt (pg-Default). */
  connectionTimeoutMillis?: number;
  /** Weitere Optionen von `pg.Pool` (z. B. `ssl`, `application_name`). */
  pool?: Omit<pg.PoolConfig, 'connectionString'>;
};

export function createPool(options?: VeitPoolOptions): pg.Pool {
  const connectionString =
    options?.connectionString ?? getDatabaseUrl(options?.fallbackUrl);
  const config: pg.PoolConfig = { ...options?.pool, connectionString };
  if (options?.max !== undefined) config.max = options.max;
  if (options?.idleTimeoutMillis !== undefined) config.idleTimeoutMillis = options.idleTimeoutMillis;
  if (options?.connectionTimeoutMillis !== undefined) config.connectionTimeoutMillis = options.connectionTimeoutMillis;
  return new pg.Pool(config);
}

/** Prüft die Verbindung mit `SELECT 1` (Health-Check, Start); wirft, wenn die Datenbank nicht antwortet. */
export async function checkDatabase(pool: Pick<pg.Pool, 'query'>): Promise<void> {
  await pool.query('SELECT 1');
}

export function createDrizzle<TSchema extends Record<string, unknown>>(
  pool: pg.Pool,
  schema: TSchema,
) {
  return drizzle(pool, { schema });
}

/** Drizzle `db.execute(sql\`...\`)` liefert driverabhängig `{ rows: T[] }`. */
export function rowsFromExecute<R>(result: unknown): R[] {
  if (typeof result !== 'object' || result === null || !('rows' in result)) {
    return [];
  }
  const { rows } = result as { rows?: unknown };
  return Array.isArray(rows) ? (rows as R[]) : [];
}
