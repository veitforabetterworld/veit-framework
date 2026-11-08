import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WebPushService, createMemoryWebPushStore, parseWebPushSubscription, type WebPushSender } from './index.js';

const vapid = { publicKey: 'BPub', privateKey: 'priv', subject: 'mailto:test@example.invalid' };
const sub = (n: number) => ({ endpoint: `https://push.example.invalid/${n}`, keys: { p256dh: 'BKey_-' + n, auth: 'auth' + n } });

function setup(statusFor: (endpoint: string) => number) {
  const calls: Array<{ endpoint: string; payload: string }> = [];
  const sender: WebPushSender = async (subscription, payload) => {
    calls.push({ endpoint: subscription.endpoint, payload });
    return { statusCode: statusFor(subscription.endpoint) };
  };
  const store = createMemoryWebPushStore();
  const service = new WebPushService({ store, vapid: () => vapid, sender });
  return { calls, store, service };
}

describe('web push', () => {
  it('accepts only https endpoints with base64url keys', () => {
    assert.ok(parseWebPushSubscription(sub(1)));
    assert.equal(parseWebPushSubscription({ ...sub(1), endpoint: 'http://push.example.invalid/1' }), null);
    assert.equal(parseWebPushSubscription({ endpoint: 'https://x.invalid', keys: { p256dh: 'a b', auth: 'c' } }), null);
    assert.equal(parseWebPushSubscription(null), null);
  });

  it('sends to every subscription of the user and removes gone ones', async () => {
    const { calls, service } = setup((endpoint) => (endpoint.endsWith('/2') ? 410 : 201));
    await service.subscribe('1', sub(1));
    await service.subscribe('1', sub(2));
    await service.subscribe('2', sub(3));
    const result = await service.sendToUser('1', { title: 'Hallo', url: '/x' });
    assert.deepEqual(result, { sent: 1, failed: 0, removed: 1 });
    assert.equal(calls.length, 2);
    assert.deepEqual(JSON.parse(calls[0].payload), { title: 'Hallo', url: '/x' });
    assert.equal((await service.status('1')).devices, 1);
  });

  it('respects the switch of the user, except for an explicit test', async () => {
    const { calls, service } = setup(() => 201);
    await service.subscribe('1', sub(1));
    await service.setEnabled('1', false);
    assert.deepEqual(await service.sendToUser('1', { title: 'x' }), { sent: 0, failed: 0, removed: 0 });
    assert.equal((await service.sendToUser('1', { title: 'x' }, { ignoreDisabled: true })).sent, 1);
    assert.equal(calls.length, 1);
  });

  it('moves an endpoint to the user who subscribes it last', async () => {
    const { service } = setup(() => 201);
    await service.subscribe('1', sub(1));
    await service.subscribe('2', sub(1));
    assert.equal((await service.status('1')).devices, 0);
    assert.equal((await service.status('2')).devices, 1);
  });

  it('sends nothing without VAPID keys', async () => {
    const store = createMemoryWebPushStore();
    const service = new WebPushService({ store, vapid: () => null });
    await store.upsert('1', sub(1), null);
    assert.equal(service.configured(), false);
    assert.deepEqual(await service.sendToUser('1', { title: 'x' }), { sent: 0, failed: 0, removed: 0 });
  });
});
