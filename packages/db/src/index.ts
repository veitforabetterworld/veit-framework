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

export function createPool(options?: { connectionString?: string; fallbackUrl?: string }): pg.Pool {
  const connectionString =
    options?.connectionString ?? getDatabaseUrl(options?.fallbackUrl);
  return new pg.Pool({ connectionString });
}

export function createDrizzle<TSchema extends Record<string, unknown>>(
  pool: pg.Pool,
  schema: TSchema,
) {
  return drizzle(pool, { schema });
}
