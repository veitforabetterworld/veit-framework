import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { describe, it } from 'node:test';
import express from 'express';
import type { SmtpSettings } from '@veit/auth-server/smtp';
import { createSecretBox } from '@veit/secret-box';
import { createAppSettingsRouter } from './express.js';
import { createAppSettings, type SqlQuery } from './index.js';
import { PLENIVO_SMTP_SETTING_KEYS, smtpSettingsFromAppSettings, smtpSettingsFromValues } from './smtp.js';

/** A key/value table behind the SQL that createAppSettings sends. */
function fakeTable(initial: Record<string, string> = {}) {
  const rows = new Map(Object.entries(initial));
  const sql: string[] = [];
  const query: SqlQuery = async (text, params = []) => {
    sql.push(text);
    if (text.startsWith('SELECT')) {
      const keys = params[0] as string[];
      return { rows: keys.filter((k) => rows.has(k)).map((key) => ({ key, value: rows.get(key) })) };
    }
    if (text.startsWith('DELETE')) rows.delete(String(params[0]));
    else if (text.startsWith('INSERT')) {
      const [key, value] = params.map(String);
      const conditional = text.includes(`IS NULL OR`);
      if (!rows.has(key) || !conditional || !rows.get(key)) rows.set(key, value);
    }
    return { rows: [] };
  };
  return { query, rows, sql };
}

const box = createSecretBox({ key: 'material', context: 'test-settings' });

describe('createAppSettings', () => {
  it('reads defaults, stores plain values and encrypted secrets', async () => {
    const db = fakeTable({ smtp_host: 'mail.example.org' });
    const settings = createAppSettings({ query: db.query, secretBox: box, secretKeys: ['smtp_password'], defaults: { smtp_port: '587' } });
    assert.deepEqual(await settings.getMany(['smtp_host', 'smtp_port', 'smtp_password', 'nope']), {
      smtp_host: 'mail.example.org',
      smtp_port: '587',
      smtp_password: null,
      nope: null,
    });
    await settings.set('smtp_password', 'pw with space ');
    assert.match(db.rows.get('smtp_password')!, /^enc1:/);
    assert.equal(await settings.get('smtp_password'), 'pw with space ');
    // '' keeps the secret, null clears it.
    await settings.set('smtp_password', '');
    assert.equal(await settings.get('smtp_password'), 'pw with space ');
    assert.deepEqual(await settings.listMasked(['smtp_host', 'smtp_port', 'smtp_password']), {
      smtp_host: 'mail.example.org',
      smtp_port: '587',
      smtp_password: { stored: true },
    });
    assert.equal(await settings.reveal('smtp_password'), 'pw with space ');
    await assert.rejects(settings.reveal('smtp_host'), { code: 'settings.not_secret' });
    await settings.set('smtp_password', null);
    assert.deepEqual((await settings.listMasked(['smtp_password'])).smtp_password, { stored: false });
    assert.ok(db.sql.some((s) => s.includes('"app_settings"') && s.includes('"updated_at" = NOW()')));
  });

  it('reads no plain-text secret', async () => {
    const db = fakeTable({ smtp_password: 'plain' });
    const settings = createAppSettings({ query: db.query, secretBox: box, secretKeys: ['smtp_password'] });
    await assert.rejects(settings.get('smtp_password'), { code: 'secret_box.not_encrypted' });
  });

  it('uses the host table and columns, and deletes empty values when asked', async () => {
    const db = fakeTable({ mail_from: 'x' });
    const settings = createAppSettings({
      query: db.query,
      table: 'app_settings',
      keyColumn: 'setting_key',
      valueColumn: 'setting_value',
      updatedAtColumn: null,
      deleteEmpty: true,
    });
    await settings.set('mail_from', '');
    assert.equal(db.rows.has('mail_from'), false);
    assert.ok(db.sql.every((s) => !s.includes('updated_at')));
    assert.ok(db.sql.some((s) => s.includes('"setting_key"')));
    assert.throws(() => createAppSettings({ query: db.query, table: 'x; drop' }));
  });

  it('generates an internal secret once', async () => {
    const db = fakeTable();
    const settings = createAppSettings({ query: db.query, secretBox: box, secretKeys: ['api_key_pepper'] });
    const first = await settings.ensureGenerated('api_key_pepper');
    assert.equal(first.length, 43);
    assert.match(db.rows.get('api_key_pepper')!, /^enc1:/);
    assert.equal(await settings.ensureGenerated('api_key_pepper'), first);
    const plain = createAppSettings({ query: db.query });
    const value = await plain.ensureGenerated('install_id', 16);
    assert.equal(db.rows.get('install_id'), value);
  });
});

describe('smtp mapping', () => {
  it('maps the default keys', async () => {
    const db = fakeTable({ smtp_host: ' mail.example.org ', smtp_port: '465', smtp_secure: '1', smtp_user: 'u', smtp_from: 'App <a@b>' });
    const settings = createAppSettings({ query: db.query, secretBox: box, secretKeys: ['smtp_password'] });
    await settings.set('smtp_password', 'pw');
    const read: () => Promise<SmtpSettings | null> = smtpSettingsFromAppSettings(settings);
    assert.deepEqual(await read(), { host: 'mail.example.org', port: 465, secure: true, user: 'u', password: 'pw', from: 'App <a@b>' });
    assert.equal(await smtpSettingsFromAppSettings(createAppSettings({ query: fakeTable().query }))(), null);
  });

  it("maps Plenivo's keys with url, TLS flag and default sender", () => {
    const values = { smtp_url: 'smtp://u:p@host:587', smtp_tls_reject_unauthorized: '0', smtp_pass: 'p', smtp_port: 'x' };
    assert.deepEqual(smtpSettingsFromValues(values, { keys: PLENIVO_SMTP_SETTING_KEYS, defaultFrom: 'Plenivo <noreply@localhost>' }), {
      host: '',
      port: 587,
      secure: false,
      user: '',
      password: 'p',
      from: 'Plenivo <noreply@localhost>',
      url: 'smtp://u:p@host:587',
      tlsRejectUnauthorized: false,
    });
  });
});

describe('express router', () => {
  it('lists masked, saves, validates and reveals', async () => {
    const db = fakeTable({ smtp_host: 'h' });
    const settings = createAppSettings({ query: db.query, secretBox: box, secretKeys: ['smtp_password'] });
    let admin = true;
    const saved: string[][] = [];
    const app = express();
    app.use(express.json());
    app.use(
      '/settings',
      createAppSettingsRouter({
        settings,
        keys: ['smtp_host', 'smtp_secure', 'smtp_password'],
        guard: (_req, res, next) => (admin ? next() : res.status(403).json({ code: 'admin.required' })),
        validate: (values) => (values.smtp_host === 'bad' ? { code: 'settings.host_invalid', key: 'smtp_host' } : null),
        onSaved: (keys) => {
          saved.push(keys);
        },
      }),
    );
    const server = app.listen(0);
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/settings`;
    const call = async (path: string, method = 'GET', body?: unknown) => {
      const res = await fetch(url + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: res.status, body: (await res.json()) as Record<string, unknown> };
    };
    try {
      assert.deepEqual((await call('')).body, { settings: { smtp_host: 'h', smtp_secure: '', smtp_password: { stored: false } } });
      const put = await call('', 'PUT', { smtp_host: ' mail ', smtp_secure: true, smtp_password: 'pw' });
      assert.deepEqual(put.body, { settings: { smtp_host: 'mail', smtp_secure: '1', smtp_password: { stored: true } } });
      assert.deepEqual(saved, [['smtp_host', 'smtp_secure', 'smtp_password']]);
      assert.deepEqual((await call('/smtp_password/secret')).body, { value: 'pw' });
      assert.equal((await call('/smtp_host/secret')).status, 404);
      assert.equal((await call('', 'PUT', { other: 'x' })).body.code, 'settings.unknown_key');
      assert.equal((await call('', 'PUT', { smtp_host: 'bad' })).body.code, 'settings.host_invalid');
      admin = false;
      assert.equal((await call('/smtp_password/secret')).status, 403);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
