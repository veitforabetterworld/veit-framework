import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';

export type { FastifyInstance } from 'fastify';

export type CreateAppOptions = {
  /**
   * Logger configuration.
   * - `false`: disable logger
   * - `true`: use defaults
   * - object: pass pino options (e.g. `{ level: 'error' }`)
   */
  logger?: boolean | { level?: string };
  /** Hinter Nginx/Proxy: `X-Forwarded-*` für Host/Proto (z. B. öffentliche URLs aus dem Request). Standard: true. */
  trustProxy?: boolean | string | number;
};

/**
 * Fastify-Instanz mit Standard-CORS (`CORS_ORIGINS` kommagetrennt, sonst `true`).
 */
export async function createApp(options?: CreateAppOptions): Promise<FastifyInstance> {
  const loggerLevel = process.env.LOG_LEVEL ?? 'error';
  const logger = options?.logger ?? { level: loggerLevel };
  const app = Fastify({
    logger,
    // Avoid per-request noise; errors are still logged via error handlers.
    disableRequestLogging: true,
    trustProxy: options?.trustProxy ?? true,
  });
  const raw = process.env.CORS_ORIGINS;
  const origin = raw
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : true;
  await app.register(cors, { origin });
  return app;
}

export type HealthRoutesMeta = {
  /** Anzeigename in GET / (JSON) */
  serviceName?: string;
};

/**
 * Root- und Health-Routen (GET /, GET /health).
 */
export function registerHealthRoutes(app: FastifyInstance, meta?: HealthRoutesMeta): void {
  const service = meta?.serviceName ?? 'api';
  app.get('/', async () => ({
    service,
    docs: 'GET /health',
  }));
  app.get('/health', async () => ({ ok: true as const }));
}

export type ListenOptions = {
  port?: number;
  host?: string;
};

/**
 * `listen` mit PORT/HOST aus der Umgebung (Standard: 3000, 0.0.0.0).
 */
export async function listen(app: FastifyInstance, opts?: ListenOptions): Promise<void> {
  const port = Number(opts?.port ?? process.env.PORT ?? 3000);
  const host = opts?.host ?? '0.0.0.0';
  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
