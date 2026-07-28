import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';

export type { FastifyInstance } from 'fastify';
export {
  HttpError,
  isHttpError,
  badRequest,
  forbidden,
  notFound,
  conflict,
  tooManyRequests,
  internalError,
  toRouteError,
} from './http-error.js';
export {
  publicAppOrigin,
  publicOriginFromHost,
  type PublicAppOriginOptions,
} from './public-origin.js';

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
  /**
   * Fastify `bodyLimit`: maximale Größe des Request-Bodys in Bytes (JSON-RPC, Webhooks, …).
   * Unset = Fastify-Standard (1 MiB).
   */
  bodyLimit?: number;
  /**
   * CORS origin. Wenn gesetzt, hat Vorrang vor `CORS_ORIGINS`.
   * - `true` / string[] / RegExp / function: an `@fastify/cors`
   * - unset: `CORS_ORIGINS` (kommagetrennt) oder `true`
   */
  corsOrigins?: boolean | string | string[] | RegExp | ((origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void);
  /**
   * Nach Basis-Setup (CORS) aufgerufen — z. B. WebSocket-Plugin, Content-Type-Parser.
   */
  setup?: (app: FastifyInstance) => void | Promise<void>;
};

/**
 * Fastify-Instanz mit Standard-CORS (`corsOrigins` oder `CORS_ORIGINS` kommagetrennt, sonst `true`).
 */
export async function createApp(options?: CreateAppOptions): Promise<FastifyInstance> {
  const loggerLevel = process.env.LOG_LEVEL ?? 'error';
  const logger = options?.logger ?? { level: loggerLevel };
  const app = Fastify({
    logger,
    // Avoid per-request noise; errors are still logged via error handlers.
    disableRequestLogging: true,
    trustProxy: options?.trustProxy ?? true,
    ...(options?.bodyLimit !== undefined ? { bodyLimit: options.bodyLimit } : {}),
  });

  let origin: CreateAppOptions['corsOrigins'];
  if (options?.corsOrigins !== undefined) {
    origin = options.corsOrigins;
  } else {
    const raw = process.env.CORS_ORIGINS;
    origin = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : true;
  }
  await app.register(cors, { origin: origin as boolean | string | string[] | RegExp });

  if (options?.setup) {
    await options.setup(app);
  }
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
