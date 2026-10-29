import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import { generateSync } from 'otplib';
import pg from 'pg';
import { createExpressAuth } from './express.js';
import { AUTH_SCHEMA_SQL, createPgAuthStore } from './pg.js';
import { createAesGcmSecretBox } from './secretBox.js';
import { AuthService } from './service.js';
import type { AuthMailer } from './types.js';

const databaseUrl = process.env.DATABASE_URL;

describe('secret box', () => {
  it('round-trips and refuses a foreign key', () => {
    const box = createAesGcmSecretBox(() => 'material', 'ctx');
    const stored = box.encrypt('JBSWY3DPEHPK3PXP');
    assert.equal(box.decrypt(stored), 'JBSWY3DPEHPK3PXP');
    assert.equal(createAesGcmSecretBox(() => 'other', 'ctx').decrypt(stored), '');
  });
});

describe('auth flows over express and postgres', { skip: databaseUrl ? false : 'DATABASE_URL is not set' }, () => {
  const schema = `auth_test_${randomBytes(4).toString('hex')}`;
  let pool: pg.Pool;
  let server: ReturnType<express.Express['listen']>;
  let base = '';
  const mails: Array<{ kind: string; to: string; token?: string; code?: string }> = [];
  const password = `Pegel-${randomBytes(9).toString('base64url')}-Aurach`;

  const mailer: AuthMailer = {
    sendVerification: async ({ to, token }) => void mails.push({ kind: 'verify', to, token }),
    sendPasswordReset: async ({ to, token }) => void mails.push({ kind: 'reset', to, token }),
    sendMfaLoginCode: async ({ to, code }) => void mails.push({ kind: 'mfa-login', to, code }),
    sendMfaSetupCode: async ({ to, code }) => void mails.push({ kind: 'mfa-setup', to, code }),
  };
  const last = (kind: string) => [...mails].reverse().find((m) => m.kind === kind)!;

  before(async () => {
    const admin = new pg.Pool({ connectionString: databaseUrl });
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.end();
    pool = new pg.Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
    await pool.query(AUTH_SCHEMA_SQL);
    const service = new AuthService({
      store: createPgAuthStore(pool),
      mailer,
      secretBox: createAesGcmSecretBox(() => 'test-key', 'test-mfa'),
      totpIssuer: 'Test',
    });
    const auth = createExpressAuth({ service, cookieName: 'sid', extendUser: () => ({ is_admin: false }) });
    const app = express();
    app.use(express.json());
    app.use(auth.router);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await pool.end();
  });

  /** A tiny cookie jar per client. */
  function client() {
    let cookie = '';
    return async (path: string, method = 'GET', body?: unknown) => {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    };
  }

  it('registers, verifies the address and reads /me', async () => {
    const c = client();
    const reg = await c('/auth/register', 'POST', { email: 'Ada@Example.org', password, first_name: 'Ada', last_name: 'L' });
    assert.equal(reg.status, 201);
    assert.equal(reg.body.user.email, 'ada@example.org');
    assert.equal(reg.body.user.is_admin, false);
    assert.equal((await c('/me')).body.email_verified_at, null);
    const verified = await c('/auth/verify-email', 'POST', { token: last('verify').token });
    assert.equal(verified.status, 200);
    assert.notEqual((await c('/me')).body.email_verified_at, null);
    assert.equal((await c('/auth/register', 'POST', { email: 'ada@example.org', password, first_name: 'A', last_name: 'B' })).status, 409);
  });

  it('logs in and out and lists sessions', async () => {
    const c = client();
    assert.equal((await c('/auth/login', 'POST', { email: 'ada@example.org', password: 'wrong' })).status, 401);
    const login = await c('/auth/login', 'POST', { email: 'ADA@example.org', password });
    assert.equal(login.body.mfa_required, false);
    const sessions = (await c('/me/sessions')).body.sessions as Array<{ is_current: boolean }>;
    assert.equal(sessions.length, 2);
    assert.equal(sessions.filter((s) => s.is_current).length, 1);
    await c('/auth/logout', 'POST');
    assert.equal((await c('/me')).status, 401);
  });

  it('turns on TOTP and asks for it at login', async () => {
    const c = client();
    await c('/auth/login', 'POST', { email: 'ada@example.org', password });
    const setup = await c('/me/mfa/totp/start', 'POST');
    const secret = setup.body.secret_base32 as string;
    assert.match(setup.body.otpauth_uri, /^otpauth:\/\/totp\//);
    assert.equal((await c('/me/mfa/totp/confirm', 'POST', { code: generateSync({ secret }) })).status, 200);

    const d = client();
    const step1 = await d('/auth/login', 'POST', { email: 'ada@example.org', password });
    assert.equal(step1.body.mfa_required, true);
    assert.equal((await d('/auth/login/mfa', 'POST', { mfa_token: step1.body.mfa_token, code: '000000' })).status, 401);
    const step2 = await d('/auth/login/mfa', 'POST', { mfa_token: step1.body.mfa_token, code: generateSync({ secret }) });
    assert.equal(step2.status, 200);
    assert.equal((await d('/me')).status, 200);
    assert.equal((await d('/me/mfa/disable', 'POST', { current_password: password })).status, 200);
  });

  it('logs in with an e-mail code', async () => {
    const c = client();
    await c('/auth/login', 'POST', { email: 'ada@example.org', password });
    await c('/me/mfa/email/start', 'POST');
    assert.equal((await c('/me/mfa/email/confirm', 'POST', { code: last('mfa-setup').code })).status, 200);
    const d = client();
    const step1 = await d('/auth/login', 'POST', { email: 'ada@example.org', password });
    assert.deepEqual(step1.body.mfa_methods, ['email']);
    await d('/auth/login/mfa/email', 'POST', { mfa_token: step1.body.mfa_token });
    const step2 = await d('/auth/login/mfa', 'POST', { mfa_token: step1.body.mfa_token, code: last('mfa-login').code });
    assert.equal(step2.status, 200);
  });

  it('resets the password, which ends sessions and MFA', async () => {
    const c = client();
    const newPassword = `${password}-neu`;
    await c('/auth/password-reset', 'POST', { email: 'ada@example.org' });
    assert.equal((await c('/auth/password-reset/confirm', 'POST', { token: last('reset').token, new_password: newPassword })).status, 200);
    assert.equal((await c('/auth/password-reset/confirm', 'POST', { token: last('reset').token, new_password: newPassword })).status, 400);
    const login = await c('/auth/login', 'POST', { email: 'ada@example.org', password: newPassword });
    assert.equal(login.body.mfa_required, false);
    const sessions = (await c('/me/sessions')).body.sessions as unknown[];
    assert.equal(sessions.length, 1);
    assert.equal((await c('/me', 'DELETE')).status, 200);
    assert.equal((await c('/auth/login', 'POST', { email: 'ada@example.org', password: newPassword })).status, 401);
  });
});
