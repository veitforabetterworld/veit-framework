import { Router, type RequestHandler, type Response } from 'express';
import { AppSettingsError, type AppSettings } from './index.js';

export type AppSettingsRouterOptions = {
  settings: AppSettings;
  /** The keys the admin area lists and may change; secrets among them can be revealed. */
  keys: readonly string[];
  /** Runs before every route, e.g. a middleware that only lets admins through. */
  guard: RequestHandler;
  /**
   * Checks a save before anything is stored: `values` are the submitted keys (secrets '' = keep), `current` the stored
   * values of all keys (secrets decrypted). Return an error code (sent as 400 with `key`) or null.
   */
  validate?: (
    values: Record<string, string>,
    current: Record<string, string | null>,
  ) => Promise<{ code: string; key?: string } | null> | { code: string; key?: string } | null;
  /** After a save, e.g. to drop a cached SMTP transport. */
  onSaved?: (keys: string[]) => void | Promise<void>;
};

function fail(res: Response, error: unknown): void {
  if (error instanceof AppSettingsError) {
    res.status(error.status).json({ error: error.code, code: error.code, key: error.key });
    return;
  }
  console.error('[app-settings]', error);
  res.status(500).json({ error: 'internal', code: 'internal' });
}

/** Strings as they are; booleans as '1'/'0'; numbers as text. Anything else is refused. */
function wireValue(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * Routes for the admin area, mounted by the host (e.g. under /admin/settings):
 * - GET  /             { settings: { key: value | { stored } } }
 * - PUT  /             body { key: value }; secrets: '' keeps the stored one. Answers like GET.
 * - GET  /:key/secret  { value } of a secret, not cached.
 */
export function createAppSettingsRouter(options: AppSettingsRouterOptions): Router {
  const { settings } = options;
  const keys = new Set(options.keys);
  const router = Router();
  router.use(options.guard);

  const list = async () => ({ settings: await settings.listMasked([...keys]) });

  router.get('/', (_req, res) => {
    list().then((body) => res.json(body), (error: unknown) => fail(res, error));
  });

  router.put('/', (req, res) => {
    (async () => {
      const body: unknown = req.body;
      if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new AppSettingsError('settings.body_invalid', 400);
      const values: Record<string, string> = {};
      for (const [key, raw] of Object.entries(body as Record<string, unknown>)) {
        if (!keys.has(key)) throw new AppSettingsError('settings.unknown_key', 400, key);
        const value = wireValue(raw);
        if (value === null) throw new AppSettingsError('settings.value_invalid', 400, key);
        values[key] = settings.isSecret(key) ? value : value.trim();
      }
      if (options.validate) {
        const problem = await options.validate(values, await settings.getMany([...keys]));
        if (problem) throw new AppSettingsError(problem.code, 400, problem.key);
      }
      await settings.setMany(values);
      await options.onSaved?.(Object.keys(values));
      res.json(await list());
    })().catch((error: unknown) => fail(res, error));
  });

  router.get('/:key/secret', (req, res) => {
    const key = String(req.params.key);
    if (!keys.has(key) || !settings.isSecret(key)) {
      fail(res, new AppSettingsError('settings.not_secret', 404, key));
      return;
    }
    settings.reveal(key).then(
      (value) => {
        res.set('Cache-Control', 'no-store');
        res.json({ value });
      },
      (error: unknown) => fail(res, error),
    );
  });

  return router;
}
