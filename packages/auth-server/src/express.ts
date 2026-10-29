import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { isAuthError } from './errors.js';
import type { AuthService, LoginResult } from './service.js';
import type { AuthUserRecord, RequestInfo } from './types.js';
import { describeUserAgent } from './userAgent.js';

export type ExpressAuthOptions = {
  service: AuthService;
  cookieName: string;
  /** Public origin of the web app for mail links; default from X-Forwarded-Proto/Host. */
  origin?: (req: Request) => string;
  /** Extra fields of GET /me and the login answers, e.g. { is_admin }. */
  extendUser?: (user: AuthUserRecord) => Promise<Record<string, unknown>> | Record<string, unknown>;
  deviceName?: (req: Request) => string | null;
};

/** Wire format of a user (snake_case, like Plenivo's API). */
export function userJson(user: AuthUserRecord) {
  return {
    id: user.id,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    display_name: `${user.firstName} ${user.lastName}`.trim() || user.email,
    email_verified_at: user.emailVerifiedAt?.toISOString() ?? null,
    mfa_enabled: user.mfaEnabled,
    mfa_method: user.mfaMethod,
    created_at: user.createdAt.toISOString(),
  };
}

const users = new WeakMap<Request, AuthUserRecord | null>();

/** The signed-in user of a request after attachUser ran, or null. */
export function getAuthUser(req: Request): AuthUserRecord | null {
  return users.get(req) ?? null;
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim()) || null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function isHttps(req: Request): boolean {
  const forwarded = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
  return req.secure || forwarded === 'https';
}

function defaultOrigin(req: Request): string {
  const proto = isHttps(req) ? 'https' : 'http';
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost').split(',')[0].trim();
  return `${proto}://${host}`;
}

function sendError(res: Response, error: unknown): void {
  if (isAuthError(error)) {
    res.status(error.status).json({ error: error.code, code: error.code, reasons: error.reasons });
    return;
  }
  console.error('[auth]', error);
  res.status(500).json({ error: 'internal', code: 'internal' });
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Express wiring of an AuthService:
 *   attachUser       resolves the session cookie on every request (getAuthUser(req))
 *   requireUser      401 without a signed-in user
 *   router           /auth/* and /me/* (see README), mount where the API lives, e.g. app.use('/v1', router)
 */
export type ExpressAuth = { router: Router; attachUser: RequestHandler; requireUser: RequestHandler };

export function createExpressAuth(options: ExpressAuthOptions): ExpressAuth {
  const { service, cookieName } = options;
  const origin = options.origin ?? defaultOrigin;

  const info = (req: Request): RequestInfo => ({
    ip: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
    origin: origin(req),
    deviceName: options.deviceName?.(req) ?? null,
  });

  const setSession = (req: Request, res: Response, session: { token: string; expiresAt: Date }) => {
    res.cookie(cookieName, session.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps(req),
      path: '/',
      maxAge: service.sessionLifetimeSec * 1000,
    });
  };

  const clearSession = (req: Request, res: Response) => {
    res.clearCookie(cookieName, { httpOnly: true, sameSite: 'lax', secure: isHttps(req), path: '/' });
  };

  const fullUser = async (user: AuthUserRecord) => ({ ...userJson(user), ...((await options.extendUser?.(user)) ?? {}) });

  const loginJson = async (result: LoginResult) =>
    result.mfaRequired
      ? { mfa_required: true, mfa_token: result.mfaToken, mfa_methods: result.mfaMethods }
      : {
          mfa_required: false,
          user: await fullUser(result.user),
          expires_at: result.session.expiresAt.toISOString(),
          password_insecure: result.passwordInsecure,
          password_security_reasons: result.passwordSecurityReasons,
        };

  const attachUser: RequestHandler = (req, _res, next) => {
    service
      .userForSession(readCookie(req, cookieName))
      .then((user) => {
        users.set(req, user);
        next();
      })
      .catch(next);
  };

  const requireUser: RequestHandler = (req, res, next) => {
    if (!getAuthUser(req)) {
      res.status(401).json({ error: 'auth.unauthenticated', code: 'auth.unauthenticated' });
      return;
    }
    next();
  };

  /** Wraps a handler: AuthErrors become their status, everything else 500. */
  const handle =
    (fn: (req: Request, res: Response) => Promise<void>) =>
    (req: Request, res: Response, _next: NextFunction) => {
      fn(req, res).catch((error: unknown) => sendError(res, error));
    };

  const me = (req: Request) => getAuthUser(req)!;

  const router = Router();
  router.use(attachUser);

  router.post(
    '/auth/register',
    handle(async (req, res) => {
      const b = req.body ?? {};
      const result = await service.register(
        { email: str(b.email), password: str(b.password), firstName: str(b.first_name), lastName: str(b.last_name) },
        info(req),
      );
      setSession(req, res, result.session);
      res.status(201).json({
        user: await fullUser(result.user),
        message: result.resent ? 'auth.verification_email_resent' : 'auth.verification_email_sent',
      });
    }),
  );

  router.post(
    '/auth/login',
    handle(async (req, res) => {
      const result = await service.login(str(req.body?.email), str(req.body?.password), info(req));
      if (!result.mfaRequired) setSession(req, res, result.session);
      res.json(await loginJson(result));
    }),
  );

  router.post(
    '/auth/login/mfa',
    handle(async (req, res) => {
      const result = await service.loginMfa(str(req.body?.mfa_token), str(req.body?.code), info(req));
      if (!result.mfaRequired) setSession(req, res, result.session);
      res.json(await loginJson(result));
    }),
  );

  router.post(
    '/auth/login/mfa/email',
    handle(async (req, res) => {
      await service.sendLoginMfaEmail(str(req.body?.mfa_token));
      res.json({ ok: true, message: 'auth.mfa_email_sent' });
    }),
  );

  router.post(
    '/auth/logout',
    handle(async (req, res) => {
      await service.logout(readCookie(req, cookieName));
      clearSession(req, res);
      res.json({ ok: true });
    }),
  );

  router.post(
    '/auth/verify-email',
    handle(async (req, res) => {
      const user = await service.verifyEmail(str(req.body?.token));
      res.json({ user: await fullUser(user), message: 'auth.verification_success' });
    }),
  );

  router.post(
    '/auth/verification/resend',
    requireUser,
    handle(async (req, res) => {
      await service.resendVerification(me(req).id, info(req));
      res.json({ message: 'auth.verification_email_sent' });
    }),
  );

  router.post(
    '/auth/password-reset',
    handle(async (req, res) => {
      await service.requestPasswordReset(str(req.body?.email), info(req));
      res.json({ message: 'auth.password_reset_email_sent' });
    }),
  );

  router.post(
    '/auth/password-reset/confirm',
    handle(async (req, res) => {
      await service.confirmPasswordReset(str(req.body?.token), str(req.body?.new_password));
      res.json({ message: 'auth.password_reset_success' });
    }),
  );

  router.get(
    '/auth/suggest-password',
    handle(async (_req, res) => {
      res.json({ password: await service.suggestPassword() });
    }),
  );

  router.get(
    '/me',
    requireUser,
    handle(async (req, res) => {
      res.json(await fullUser(me(req)));
    }),
  );

  router.patch(
    '/me',
    requireUser,
    handle(async (req, res) => {
      const b = req.body ?? {};
      const user = await service.patchProfile(
        me(req).id,
        {
          firstName: b.first_name === undefined ? undefined : str(b.first_name),
          lastName: b.last_name === undefined ? undefined : str(b.last_name),
          email: b.email === undefined ? undefined : str(b.email),
        },
        info(req),
      );
      res.json(await fullUser(user));
    }),
  );

  router.post(
    '/me/password',
    requireUser,
    handle(async (req, res) => {
      const session = await service.changePassword(
        me(req).id,
        str(req.body?.current_password),
        str(req.body?.new_password),
        info(req),
      );
      setSession(req, res, session);
      res.json({ ok: true });
    }),
  );

  router.get(
    '/me/sessions',
    requireUser,
    handle(async (req, res) => {
      const sessions = await service.listSessions(me(req).id, readCookie(req, cookieName));
      res.json({
        sessions: sessions.map((s) => ({
          id: s.id,
          login_time: s.loginTime.toISOString(),
          last_used_at: (s.lastUsedAt ?? s.loginTime).toISOString(),
          expires_at: s.expiresAt.toISOString(),
          ip_address: s.ipAddress,
          device: s.deviceName || describeUserAgent(s.userAgent),
          is_current: s.isCurrent,
        })),
      });
    }),
  );

  router.delete(
    '/me/sessions/:id',
    requireUser,
    handle(async (req, res) => {
      await service.revokeSession(me(req).id, String(req.params.id));
      res.json({ ok: true });
    }),
  );

  router.get(
    '/me/mfa',
    requireUser,
    handle(async (req, res) => {
      const user = me(req);
      res.json({ mfa_enabled: user.mfaEnabled, mfa_method: user.mfaMethod });
    }),
  );

  router.post(
    '/me/mfa/totp/start',
    requireUser,
    handle(async (req, res) => {
      const setup = await service.startTotpSetup(me(req).id);
      res.json({ secret_base32: setup.secretBase32, otpauth_uri: setup.otpauthUri });
    }),
  );

  router.post(
    '/me/mfa/totp/confirm',
    requireUser,
    handle(async (req, res) => {
      await service.confirmTotpSetup(me(req).id, str(req.body?.code));
      res.json({ ok: true });
    }),
  );

  router.post(
    '/me/mfa/email/start',
    requireUser,
    handle(async (req, res) => {
      await service.startEmailMfaSetup(me(req).id);
      res.json({ ok: true, message: 'auth.mfa_setup_email_sent' });
    }),
  );

  router.post(
    '/me/mfa/email/confirm',
    requireUser,
    handle(async (req, res) => {
      await service.confirmEmailMfaSetup(me(req).id, str(req.body?.code));
      res.json({ ok: true });
    }),
  );

  router.post(
    '/me/mfa/disable',
    requireUser,
    handle(async (req, res) => {
      await service.disableMfa(me(req).id, str(req.body?.current_password));
      res.json({ ok: true });
    }),
  );

  router.delete(
    '/me',
    requireUser,
    handle(async (req, res) => {
      await service.deleteAccount(me(req).id);
      clearSession(req, res);
      res.json({ ok: true });
    }),
  );

  return { router, attachUser, requireUser };
}
