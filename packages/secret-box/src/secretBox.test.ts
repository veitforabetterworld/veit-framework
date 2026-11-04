import assert from 'node:assert/strict';
import { createDecipheriv, createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import type { Pool, PoolClient } from 'pg';
import { SecretBoxError, createSecretBox } from './index.js';
import { ReencryptError, decodeLegacy, looksEncrypted, reencryptRows, type SqlClient, type SqlPool, type SqlQuery } from './migrate.js';

// Vectors written by the code the formats come from (before this package existed).
/** Sprachassistent apps/api/src/secrets.ts encrypt('gsk_live_123'), CREDENTIALS_KEY=test-material. */
const SPRACHASSISTENT_ENC1 =
  'enc1:eyJpdiI6InptYU1TRGJJKzBHd3ZqSm8iLCJ0YWciOiJHaEx3ekVadWFFOTMvdjFja0lSd0pnPT0iLCJkIjoiUjE2RnFyNzlEWmJsbjJ0RSJ9';
/** Old createAesGcmSecretBox(() => 'mfa-material', 'plenivo-mfa-totp').encrypt('JBSWY3DPEHPK3PXP'). */
const AUTH_JSON =
  'eyJpdiI6Ikp4U2JSdWE3TmdBQWVTUnIiLCJ0YWciOiJjcUxINTlXaHRKQUNPTWx5cXl3ZDNRPT0iLCJkIjoibWNvUlRVUjBabkMvNUFVWGd6TGkxZz09In0=';
/** Old encryptApiKey('spa_abcdef', 'key-secret') of '@veit/api-keys'. */
const COMPACT_SHA256 = 'lF7jiLST3dtp7PLA.Huh2xsymLo--SOOA0ir24g._A6aAVm6T_M8Lg';
/** Scangut encryptValue('scan-secret') with this key. */
const SCANGUT_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
const COMPACT_RAW_HEX = 'vddkSlWWcoXVRePi.zqxCogs9G1O-Y26oaYasiw.K3GZhpdNLgb7-Dg';

/** Sprachassistent's decrypt (apps/api/src/secrets.ts), copied: the Node and Rust readers there must keep working. */
function sprachassistentDecrypt(stored: string, material: string): string {
  if (!stored || !stored.startsWith('enc1:')) return stored;
  const key = createHash('sha256').update(`${material.trim()}|sprachassistent-credentials`).digest();
  const payload = JSON.parse(Buffer.from(stored.slice(5), 'base64').toString('utf8')) as { iv: string; tag: string; d: string };
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  if (iv.length !== 12 || tag.length !== 16) throw new Error('unreadable');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(payload.d, 'base64')), decipher.final()]).toString('utf8');
}

describe('createSecretBox', () => {
  const box = createSecretBox({ key: 'test-material', context: 'sprachassistent-credentials' });

  it('round-trips and writes enc1:', () => {
    const stored = box.encrypt('geheim');
    assert.match(stored, /^enc1:/);
    assert.equal(box.isEncrypted(stored), true);
    assert.equal(box.decrypt(stored), 'geheim');
    assert.equal(box.encrypt(''), '');
    assert.equal(box.decrypt(''), '');
  });

  it('reads what sprachassistent wrote, and sprachassistent reads what it writes', () => {
    assert.equal(box.decrypt(SPRACHASSISTENT_ENC1), 'gsk_live_123');
    assert.equal(sprachassistentDecrypt(box.encrypt('gsk_live_123'), 'test-material'), 'gsk_live_123');
    // Material is trimmed like there (and in src/secrets.rs).
    assert.equal(createSecretBox({ key: ' test-material\n', context: 'sprachassistent-credentials' }).decrypt(SPRACHASSISTENT_ENC1), 'gsk_live_123');
  });

  it('reads no other format and no plain text', () => {
    for (const value of ['plain', AUTH_JSON, COMPACT_SHA256, COMPACT_RAW_HEX]) {
      assert.throws(() => box.decrypt(value), (e: unknown) => e instanceof SecretBoxError && e.code === 'secret_box.not_encrypted');
      assert.equal(box.isEncrypted(value), false);
    }
    const other = createSecretBox({ key: 'test-material', context: 'other' });
    assert.throws(() => other.decrypt(SPRACHASSISTENT_ENC1), (e: unknown) => e instanceof SecretBoxError && e.code === 'secret_box.unreadable');
  });

  it('reads the key on every call', () => {
    let material = '';
    const live = createSecretBox({ key: () => material, context: 'c' });
    assert.equal(live.enabled(), false);
    assert.throws(() => live.encrypt('x'), (e: unknown) => e instanceof SecretBoxError && e.code === 'secret_box.no_key');
    material = 'a';
    const stored = live.encrypt('x');
    assert.equal(live.enabled(), true);
    material = 'b';
    assert.throws(() => live.decrypt(stored));
    material = 'a';
    assert.equal(live.decrypt(stored), 'x');
  });
});

describe('decodeLegacy', () => {
  it('opens every legacy kind', () => {
    assert.equal(decodeLegacy(AUTH_JSON, [{ kind: 'auth-json', key: 'mfa-material', context: 'plenivo-mfa-totp' }]), 'JBSWY3DPEHPK3PXP');
    assert.equal(decodeLegacy(COMPACT_SHA256, [{ kind: 'compact-sha256', secret: 'key-secret' }]), 'spa_abcdef');
    assert.equal(decodeLegacy(COMPACT_RAW_HEX, [{ kind: 'compact-raw-hex', keyHex: SCANGUT_KEY }]), 'scan-secret');
    assert.equal(decodeLegacy(SPRACHASSISTENT_ENC1, [{ kind: 'canonical', key: 'test-material', context: 'sprachassistent-credentials' }]), 'gsk_live_123');
    assert.equal(decodeLegacy('smtp-pass', [{ kind: 'plaintext' }]), 'smtp-pass');
    assert.equal(decodeLegacy('', []), '');
  });

  it('tries sources in order and refuses what none opens', () => {
    const sources = [
      { kind: 'auth-json', key: 'wrong', context: 'plenivo-mfa-totp' },
      { kind: 'compact-sha256', secret: 'key-secret' },
      { kind: 'plaintext' },
    ] as const;
    assert.equal(decodeLegacy(COMPACT_SHA256, sources), 'spa_abcdef');
    assert.equal(decodeLegacy('plain', sources), 'plain');
    // Ciphertext under an unknown key is not taken for plain text.
    assert.equal(looksEncrypted(AUTH_JSON), true);
    assert.throws(() => decodeLegacy(AUTH_JSON, sources));
    assert.throws(() => decodeLegacy(COMPACT_RAW_HEX, sources));
    assert.throws(() => decodeLegacy(SPRACHASSISTENT_ENC1, sources));
  });
});

/** An in-memory table behind the SQL that reencryptRows sends. */
function fakeDb(initial: Record<string, unknown>) {
  let committed = new Map(Object.entries(initial));
  let working = new Map(committed);
  const log: string[] = [];
  const query: SqlQuery = async (text, params = []) => {
    log.push(text.split(' ')[0]);
    if (text === 'BEGIN') working = new Map(committed);
    else if (text === 'COMMIT') committed = new Map(working);
    else if (text === 'ROLLBACK') working = new Map(committed);
    else if (text.startsWith('SELECT')) {
      return { rows: [...working].filter(([, v]) => v !== null).map(([id, value]) => ({ id, value })) };
    } else if (text.startsWith('UPDATE')) working.set(String(params[0]), params[1]);
    return { rows: [] };
  };
  return { query, log, value: (id: string) => committed.get(id) };
}

describe('reencryptRows', () => {
  const box = createSecretBox({ key: 'new-material', context: 'host-mfa' });
  const sources = [{ kind: 'auth-json', key: 'mfa-material', context: 'plenivo-mfa-totp' }, { kind: 'plaintext' }] as const;

  it('converts legacy values, keeps canonical ones, in one transaction', async () => {
    const canonical = box.encrypt('KEEP');
    const db = fakeDb({ 1: AUTH_JSON, 2: canonical, 3: '', 4: 'plainsecret', 5: null });
    const result = await reencryptRows({ client: db.query, table: 'users', idColumn: 'id', column: 'mfa_totp_secret_enc', box, sources });
    assert.deepEqual(result, { converted: 2, alreadyCanonical: 1, empty: 1, failed: [], committed: true });
    assert.equal(box.decrypt(String(db.value('1'))), 'JBSWY3DPEHPK3PXP');
    assert.equal(db.value('2'), canonical);
    assert.equal(box.decrypt(String(db.value('4'))), 'plainsecret');
    assert.deepEqual(db.log, ['BEGIN', 'SELECT', 'UPDATE', 'UPDATE', 'COMMIT']);
  });

  it('commits nothing when a value fails, unless allowed', async () => {
    const db = fakeDb({ 1: AUTH_JSON, 2: COMPACT_SHA256 });
    await assert.rejects(
      reencryptRows({ client: db.query, table: 'users', idColumn: 'id', column: 'c', box, sources }),
      (e: unknown) => e instanceof ReencryptError && e.result.failed.length === 1 && e.result.failed[0].id === '2' && !e.result.committed,
    );
    assert.equal(db.value('1'), AUTH_JSON);
    const partial = await reencryptRows({ client: db.query, table: 'users', idColumn: 'id', column: 'c', box, sources, allowFailures: true });
    assert.equal(partial.converted, 1);
    assert.equal(box.decrypt(String(db.value('1'))), 'JBSWY3DPEHPK3PXP');
  });

  it('counts only in a dry run', async () => {
    const db = fakeDb({ 1: AUTH_JSON });
    const result = await reencryptRows({ client: { query: db.query }, table: 'users', idColumn: 'id', column: 'c', box, sources, dryRun: true });
    assert.equal(result.converted, 1);
    assert.equal(result.committed, false);
    assert.equal(db.value('1'), AUTH_JSON);
  });

  it('converts fields of a JSON column', async () => {
    const db = fakeDb({ 1: { token: COMPACT_SHA256, name: 'x' }, 2: JSON.stringify({ token: '' }) });
    const result = await reencryptRows({
      client: db.query,
      table: 'mcp_servers',
      idColumn: 'id',
      column: 'config',
      box,
      sources: [{ kind: 'compact-sha256', secret: 'key-secret' }],
      jsonFields: ['token'],
    });
    assert.equal(result.converted, 1);
    assert.equal(result.empty, 1);
    const doc = JSON.parse(String(db.value('1'))) as { token: string; name: string };
    assert.equal(doc.name, 'x');
    assert.equal(box.decrypt(doc.token), 'spa_abcdef');
  });

  it('rejects odd identifiers', async () => {
    await assert.rejects(reencryptRows({ client: fakeDb({}).query, table: 'users; drop', idColumn: 'id', column: 'c', box, sources }));
  });

  it('takes pg types', () => {
    // Compile-time only: pg's Pool and PoolClient fit the options.
    const asPool = (pool: Pool): SqlPool => pool;
    const asClient = (client: PoolClient): SqlClient => client;
    assert.equal(typeof asPool, 'function');
    assert.equal(typeof asClient, 'function');
  });
});
