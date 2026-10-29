import { Router, type Request, type RequestHandler, type Response } from 'express';
import { ApiKeyError, apiKeyJson, type ApiKeyInput, type ApiKeyRecord, type ApiKeyService, type UserId } from './index.js';

export type ExpressApiKeysOptions = {
  service: ApiKeyService;
  /** Request header with the key; default 'X-API-Key'. */
  header?: string;
  /** Signed-in user of the request (e.g. getAuthUser from '@veit/auth-server/express'), or null. */
  userId: (req: Request) => UserId | null;
};

export type ExpressApiKeys = {
  /** /me/api-keys for the signed-in user: list, create, update, revoke. */
  router: Router;
  /** Resolves the key header on every request; read it with getApiKey(req). */
  attachApiKey: RequestHandler;
};

const keys = new WeakMap<Request, ApiKeyRecord | null>();

/** The key of a request after attachApiKey ran, or null. */
export function getApiKey(req: Request): ApiKeyRecord | null {
  return keys.get(req) ?? null;
}

function fail(res: Response, error: unknown): void {
  if (error instanceof ApiKeyError) {
    res.status(error.status).json({ error: error.code, code: error.code });
    return;
  }
  console.error('[api-keys]', error);
  res.status(500).json({ error: 'internal', code: 'internal' });
}

/** Body fields of create and update (snake_case wire format). */
function parseInput(body: unknown, partial: boolean): Partial<ApiKeyInput> | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const out: Partial<ApiKeyInput> = {};
  if (b.label !== undefined) {
    if (typeof b.label !== 'string') return null;
    out.label = b.label;
  }
  if (b.permissions !== undefined) {
    if (!Array.isArray(b.permissions) || !b.permissions.every((p) => typeof p === 'string')) return null;
    out.permissions = b.permissions as string[];
  }
  if (b.all_resources !== undefined) {
    if (typeof b.all_resources !== 'boolean') return null;
    out.allResources = b.all_resources;
  }
  if (b.resources !== undefined) {
    if (!Array.isArray(b.resources) || !b.resources.every((r) => typeof r === 'string')) return null;
    out.resources = b.resources as string[];
  }
  if (!partial && (out.label === undefined || out.permissions === undefined || out.allResources === undefined)) return null;
  return out;
}

export function createExpressApiKeys(options: ExpressApiKeysOptions): ExpressApiKeys {
  const { service } = options;
  const header = options.header ?? 'X-API-Key';

  const attachApiKey: RequestHandler = (req, _res, next) => {
    if (keys.has(req)) {
      next();
      return;
    }
    service
      .authenticate(req.get(header))
      .then((key) => {
        keys.set(req, key);
        next();
      })
      .catch(next);
  };

  const router = Router();
  const withUser =
    (fn: (userId: UserId, req: Request, res: Response) => Promise<void>): RequestHandler =>
    (req, res) => {
      const userId = options.userId(req);
      if (userId === null) {
        res.status(401).json({ error: 'auth.unauthenticated', code: 'auth.unauthenticated' });
        return;
      }
      fn(userId, req, res).catch((error: unknown) => fail(res, error));
    };

  router.get(
    '/me/api-keys',
    withUser(async (userId, _req, res) => {
      res.json({ keys: (await service.list(userId)).map(apiKeyJson), permissions: service.permissions });
    }),
  );

  router.post(
    '/me/api-keys',
    withUser(async (userId, req, res) => {
      const input = parseInput(req.body, false);
      if (!input) throw new ApiKeyError('api_keys.body_invalid', 400);
      const { key, record } = await service.create(userId, {
        label: input.label!,
        permissions: input.permissions!,
        allResources: input.allResources!,
        resources: input.resources ?? [],
      });
      res.status(201).json({ key, api_key: apiKeyJson(record) });
    }),
  );

  router.patch(
    '/me/api-keys/:id',
    withUser(async (userId, req, res) => {
      const input = parseInput(req.body, true);
      if (!input) throw new ApiKeyError('api_keys.body_invalid', 400);
      res.json(apiKeyJson(await service.update(userId, String(req.params.id), input)));
    }),
  );

  router.delete(
    '/me/api-keys/:id',
    withUser(async (userId, req, res) => {
      await service.revoke(userId, String(req.params.id));
      res.json({ ok: true });
    }),
  );

  return { router, attachApiKey };
}
