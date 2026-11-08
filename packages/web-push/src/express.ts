import { Router, type Request, type RequestHandler, type Response } from 'express';
import { WebPushError, type UserId, type WebPushPayload, type WebPushService } from './index.js';

export type ExpressWebPushOptions = {
  service: WebPushService;
  /** Signed-in user of the request (e.g. getAuthUser from '@veit/auth-server/express'), or null. */
  userId: (req: Request) => UserId | null;
  /** The test notification (texts in the user's language are the host's job). */
  testPayload: (req: Request) => WebPushPayload;
};

function fail(res: Response, error: unknown): void {
  if (error instanceof WebPushError) {
    res.status(error.status).json({ error: error.code, code: error.code });
    return;
  }
  console.error('[web-push]', error);
  res.status(500).json({ error: 'internal', code: 'internal' });
}

/**
 * /me/push for the signed-in user:
 *   GET    /me/push                 { configured, public_key, enabled, devices }
 *   PUT    /me/push                 { enabled } → as GET
 *   POST   /me/push/subscriptions   PushSubscription.toJSON() → 201 { id }
 *   DELETE /me/push/subscriptions   { endpoint } → { ok }
 *   POST   /me/push/test            { endpoint? } → { sent, failed, removed }
 */
export function createExpressWebPush(options: ExpressWebPushOptions): Router {
  const { service } = options;
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

  const sendStatus = async (userId: UserId, res: Response) => {
    const status = await service.status(userId);
    res.set('Cache-Control', 'no-store');
    res.json({ configured: status.configured, public_key: status.publicKey, enabled: status.enabled, devices: status.devices });
  };

  router.get(
    '/me/push',
    withUser(async (userId, _req, res) => sendStatus(userId, res)),
  );

  router.put(
    '/me/push',
    withUser(async (userId, req, res) => {
      const enabled = (req.body as { enabled?: unknown } | undefined)?.enabled;
      if (typeof enabled !== 'boolean') throw new WebPushError('web_push.body_invalid', 400);
      await service.setEnabled(userId, enabled);
      await sendStatus(userId, res);
    }),
  );

  router.post(
    '/me/push/subscriptions',
    withUser(async (userId, req, res) => {
      if (!service.configured()) throw new WebPushError('web_push.not_configured', 503);
      const record = await service.subscribe(userId, req.body, req.get('user-agent') ?? null);
      res.status(201).json({ id: record.id });
    }),
  );

  router.delete(
    '/me/push/subscriptions',
    withUser(async (userId, req, res) => {
      const endpoint = (req.body as { endpoint?: unknown } | undefined)?.endpoint;
      if (typeof endpoint !== 'string') throw new WebPushError('web_push.body_invalid', 400);
      await service.unsubscribe(userId, endpoint);
      res.json({ ok: true });
    }),
  );

  router.post(
    '/me/push/test',
    withUser(async (userId, req, res) => {
      if (!service.configured()) throw new WebPushError('web_push.not_configured', 503);
      const endpoint = (req.body as { endpoint?: unknown } | undefined)?.endpoint;
      const result = await service.sendToUser(userId, options.testPayload(req), {
        endpoint: typeof endpoint === 'string' ? endpoint : undefined,
        ignoreDisabled: true,
        urgency: 'high',
        ttl: 300,
      });
      if (result.sent === 0) throw new WebPushError(result.removed > 0 ? 'web_push.subscription_gone' : 'web_push.not_delivered', 502);
      res.json(result);
    }),
  );

  return router;
}
