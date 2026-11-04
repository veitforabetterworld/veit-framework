import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSecretBox } from '@veit/secret-box';
import { API_KEYS_SECRET_CONTEXT, ApiKeyService, apiKeyJson, hashApiKey, type ApiKeyRecord, type ApiKeyStore, type UserId } from './index.js';
import { legacySha256Hash } from './migrate.js';

type Row = ApiKeyRecord & { keyHash: string; keyEnc: string | null; createdBy?: UserId };

/** ApiKeyStore in memory, with the optional transition methods. */
function memoryStore(): ApiKeyStore & { rows: Row[] } {
  const rows: Row[] = [];
  const pub = ({ keyHash: _h, keyEnc: _e, createdBy: _c, ...record }: Row): ApiKeyRecord => record;
  return {
    rows,
    async insert(input) {
      const row: Row = {
        id: String(rows.length + 1),
        userId: input.userId,
        label: input.label,
        prefix: input.prefix,
        permissions: input.permissions,
        allResources: input.allResources,
        resources: input.resources,
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: null,
        revealable: input.keyEnc !== null,
        legacyHash: false,
        keyHash: input.keyHash,
        keyEnc: input.keyEnc,
        createdBy: input.createdBy,
      };
      rows.push(row);
      return pub(row);
    },
    async list(userId) {
      return rows.filter((r) => r.userId === userId).map(pub);
    },
    async find(userId, id) {
      const row = rows.find((r) => r.userId === userId && r.id === id);
      return row ? pub(row) : null;
    },
    async findKeyEnc(userId, id) {
      return rows.find((r) => r.userId === userId && r.id === id && !r.revokedAt)?.keyEnc ?? null;
    },
    async findByHash(keyHash) {
      const row = rows.find((r) => r.keyHash === keyHash && !r.revokedAt && !r.legacyHash);
      return row ? pub(row) : null;
    },
    async findByLegacyHash(legacyHash) {
      const row = rows.find((r) => r.keyHash === legacyHash && !r.revokedAt && r.legacyHash);
      return row ? pub(row) : null;
    },
    async upgradeHash(id, keyHash) {
      const row = rows.find((r) => r.id === id)!;
      row.keyHash = keyHash;
      row.legacyHash = false;
    },
    async update() {
      return null;
    },
    async revoke() {
      return false;
    },
    async touch() {},
    async addResource() {},
    async forgetResource() {},
  };
}

const legacyRow = (token: string): Row => ({
  id: '99',
  userId: 7,
  label: 'alt',
  prefix: token.slice(0, 12),
  permissions: ['members.read'],
  allResources: true,
  resources: [],
  createdAt: new Date(),
  lastUsedAt: null,
  revokedAt: null,
  revealable: false,
  legacyHash: true,
  keyHash: legacySha256Hash(token),
  keyEnc: null,
});

describe('ApiKeyService', () => {
  it('stores key_enc in the enc1: format and reveals it', async () => {
    const store = memoryStore();
    const service = new ApiKeyService({ store, permissions: ['a'], prefix: 'spa', pepper: () => 'p', secret: () => 's' });
    const { key, record } = await service.create(1, { label: 'x', permissions: ['a'], allResources: true, resources: [] }, { createdBy: 5 });
    assert.match(store.rows[0].keyEnc!, /^enc1:/);
    assert.equal(createSecretBox({ key: 's', context: API_KEYS_SECRET_CONTEXT }).decrypt(store.rows[0].keyEnc!), key);
    assert.equal(store.rows[0].keyHash, hashApiKey(key, 'p'));
    assert.equal(store.rows[0].createdBy, 5);
    assert.equal(await service.reveal(1, record.id), key);
    // The old compact layout is not read any more.
    store.rows[0].keyEnc = 'lF7jiLST3dtp7PLA.Huh2xsymLo--SOOA0ir24g._A6aAVm6T_M8Lg';
    await assert.rejects(service.reveal(1, record.id), { code: 'api_keys.not_revealable' });
  });

  it('accepts a marked legacy key only with legacyHash, and re-hashes it on use', async () => {
    const token = 'plv_0123456789abcdef0123456789abcdef0123456789abcdef';
    const strict = memoryStore();
    strict.rows.push(legacyRow(token));
    assert.equal(await new ApiKeyService({ store: strict, permissions: [], prefix: 'plv' }).authenticate(token), null);
    assert.equal(apiKeyJson(strict.rows[0]).needs_rotation, true);

    const store = memoryStore();
    store.rows.push(legacyRow(token));
    const service = new ApiKeyService({ store, permissions: [], prefix: 'plv', legacyHash: legacySha256Hash });
    const first = await service.authenticate(token);
    assert.equal(first?.id, '99');
    assert.equal(store.rows[0].legacyHash, false);
    assert.equal(store.rows[0].keyHash, hashApiKey(token));
    // From now on the current scheme finds it, also without the option.
    assert.equal((await new ApiKeyService({ store, permissions: [], prefix: 'plv' }).authenticate(token))?.id, '99');
    assert.equal(await service.authenticate('plv_other'), null);
  });
});
