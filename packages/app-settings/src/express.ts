import { Router, type RequestHandler, type Response } from 'express';
import { AppSettingsError, type AppSettings } from './index.js';

export type AppSettingsRouterOptions = {
  settings: AppSettings;
  /** The keys the admin area lists and may change; secrets among them can be revealed. */
  keys: readonly string[];
  /** Runs before every route, e.g. a middleware that only lets admins through. */
  guard: RequestHandler;
  /**
   * Checks a save before anything is stored: `values` are the submitted keys (secrets '' = keep, null = delete), `current`
   * the stored values of all keys (secrets decrypted). Return an error code (sent as 400 with `fields: { [key]: code }`)
   * or null. A method, so hosts may keep a callback typed with `Record<string, string>`.
   */
  validate?(
    values: Record<string, string | null>,
    current: Record<string, string | null>,
  ): Promise<{ code: string; key?: string } | null> | { code: string; key?: string } | null;
  /** After a save, e.g. to drop a cached SMTP transport. */
  onSaved?: (keys: string[]) => void | Promise<void>;
};

function fail(res: Response, error: unknown): void {
  if (error instanceof AppSettingsError) {
    // `fields` is what veitFetchJson of '@veit/react-auth' reads (VeitApiError.fieldErrors); `key` stays for older clients.
    const body: Record<string, unknown> = { error: error.code, code: error.code };
    if (error.key !== undefined) {
      body.key = error.key;
      body.fields = { [error.key]: error.code };
    }
    res.status(error.status).json(body);
    return;
  }
  console.error('[app-settings]', error);
  res.status(500).json({ error: 'internal', code: 'internal' });
}

/** Strings as they are; booleans as '1'/'0'; numbers as text; null clears. Anything else is refused (undefined). */
function wireValue(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

/**
 * Routes for the admin area, mounted by the host (e.g. under /admin/settings):
 * - GET  /             { settings: { key: value | { stored } } }
 * - PUT  /             body { key: value }; secrets: '' keeps the stored one, null deletes it; null clears other keys
 *                      too (sent as ''). Answers like GET. Errors: 400 { code, key, fields: { [key]: code } }.
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
      const values: Record<string, string | null> = {};
      for (const [key, raw] of Object.entries(body as Record<string, unknown>)) {
        if (!keys.has(key)) throw new AppSettingsError('settings.unknown_key', 400, key);
        const value = wireValue(raw);
        if (value === undefined) throw new AppSettingsError('settings.value_invalid', 400, key);
        // null reaches validate and set only for secrets (delete); a plain key is cleared with ''.
        values[key] = settings.isSecret(key) ? value : (value ?? '').trim();
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
