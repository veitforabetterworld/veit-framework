import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import pg from 'pg';
import { createExpressApiKeys, getApiKey } from './express.js';
import { ApiKeyService, apiKeyAllows, type ApiKeyRecord } from './index.js';
import { API_KEYS_SCHEMA_SQL, createPgApiKeyStore } from './pg.js';

const base: ApiKeyRecord = {
  id: 'k',
  userId: '1',
  label: 'x',
  prefix: 'hwd_abc',
  permissions: ['stations.write', 'observations.read'],
  allResources: false,
  resources: ['s1'],
  createdAt: new Date(),
  lastUsedAt: null,
  revokedAt: null,
};

describe('apiKeyAllows', () => {
  it('checks permission and whitelist', () => {
    assert.equal(apiKeyAllows(base, 'stations.write', 's1'), true);
    assert.equal(apiKeyAllows(base, 'stations.write', 's2'), false);
    assert.equal(apiKeyAllows(base, 'stations.write'), true);
    assert.equal(apiKeyAllows(base, 'observations.write', 's1'), false);
    assert.equal(apiKeyAllows({ ...base, allResources: true }, 'observations.read', 'anything'), true);
    assert.equal(apiKeyAllows({ ...base, revokedAt: new Date() }, 'stations.write', 's1'), false);
  });
});

const databaseUrl = process.env.DATABASE_URL;

describe('api keys over express and postgres', { skip: databaseUrl ? false : 'DATABASE_URL is not set' }, () => {
  const schema = `apikeys_test_${randomBytes(4).toString('hex')}`;
  let pool: pg.Pool;
  let server: ReturnType<express.Express['listen']>;
  let url = '';
  let service: ApiKeyService;

  before(async () => {
    const admin = new pg.Pool({ connectionString: databaseUrl });
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.end();
    pool = new pg.Pool({ connectionString: databaseUrl, options: `-c search_path=${schema},public` });
    await pool.query(`CREATE TABLE users (id BIGINT PRIMARY KEY)`);
    await pool.query(`INSERT INTO users VALUES (1), (2)`);
    await pool.query(API_KEYS_SCHEMA_SQL);
    service = new ApiKeyService({
      store: createPgApiKeyStore(pool),
      permissions: ['stations.write', 'observations.write', 'observations.read'],
      prefix: 'hwd',
      pepper: () => 'pepper',
      foreignResources: async (_user, resources) => resources.filter((r) => !r.startsWith('own-')),
    });
    const keys = createExpressApiKeys({ service, userId: (req) => req.get('x-test-user') ?? null });
    const app = express();
    app.use(express.json());
    app.use(keys.attachApiKey);
    app.use(keys.router);
    app.get('/whoami', (req, res) => {
      const key = getApiKey(req);
      res.json(key ? { user: key.userId, resources: key.resources } : null);
    });
    server = app.listen(0);
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await pool.end();
  });

  const call = async (path: string, init: { method?: string; user?: string; key?: string; body?: unknown } = {}) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (init.user) headers['x-test-user'] = init.user;
    if (init.key) headers['X-API-Key'] = init.key;
    const res = await fetch(`${url}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    return { status: res.status, body: await res.json() };
  };

  it('creates, uses, narrows and revokes a key', async () => {
    assert.equal((await call('/me/api-keys')).status, 401);
    const bad = await call('/me/api-keys', {
      method: 'POST',
      user: '1',
      body: { label: 'x', permissions: ['stations.write'], all_resources: false, resources: ['foreign'] },
    });
    assert.equal(bad.body.code, 'api_keys.resource_unknown');

    const created = await call('/me/api-keys', {
      method: 'POST',
      user: '1',
      body: { label: 'Empfänger', permissions: ['observations.write'], all_resources: false, resources: ['own-a', 'own-a'] },
    });
    assert.equal(created.status, 201);
    const key = created.body.key as string;
    assert.match(key, /^hwd_/);
    assert.deepEqual(created.body.api_key.resources, ['own-a']);

    assert.deepEqual((await call('/whoami', { key })).body, { user: '1', resources: ['own-a'] });
    assert.equal((await call('/whoami', { key: `${key}x` })).body, null);

    const record = (await service.authenticate(key))!;
    await service.grantCreated(record, 'own-b');
    assert.deepEqual((await call('/whoami', { key })).body.resources, ['own-a', 'own-b']);

    const id = created.body.api_key.id as string;
    assert.equal((await call(`/me/api-keys/${id}`, { method: 'PATCH', user: '2', body: { label: 'y' } })).status, 404);
    const widened = await call(`/me/api-keys/${id}`, { method: 'PATCH', user: '1', body: { all_resources: true } });
    assert.equal(widened.body.all_resources, true);
    assert.deepEqual(widened.body.resources, []);

    assert.equal((await call(`/me/api-keys/${id}`, { method: 'DELETE', user: '1' })).status, 200);
    assert.equal((await call('/whoami', { key })).body, null);
    assert.equal((await call('/me/api-keys', { user: '1' })).body.keys[0].revoked_at !== null, true);
  });
});
