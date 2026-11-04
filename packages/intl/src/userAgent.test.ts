import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clientKindFromUserAgent, describeUserAgent, parseUserAgent } from './userAgent.js';

const UA = {
  firefoxWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  edgeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  samsungAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  okhttpAndroid: 'okhttp/4.12.0 (Android 14)',
  curl: 'curl/8.5.0',
};

describe('user agent', () => {
  it('parses browser and system', () => {
    assert.deepEqual(parseUserAgent(UA.edgeWindows), { browser: 'edge', browserName: 'Edge', os: 'windows', osName: 'Windows' });
    assert.equal(parseUserAgent(UA.safariIphone).os, 'ios');
    assert.equal(parseUserAgent(UA.samsungAndroid).browser, 'samsung');
    assert.equal(parseUserAgent(null).browser, 'unknown');
  });

  it('describes like before', () => {
    assert.equal(describeUserAgent(UA.firefoxWindows), 'Firefox · Windows');
    assert.equal(describeUserAgent(UA.chromeMac), 'Chrome · macOS');
    assert.equal(describeUserAgent(UA.safariIphone), 'Safari · iOS');
    assert.equal(describeUserAgent(UA.curl), 'curl');
    assert.equal(describeUserAgent('SomethingElse/1'), 'SomethingElse/1');
    assert.equal(describeUserAgent(null), '');
  });

  it('picks the icon slot', () => {
    assert.equal(clientKindFromUserAgent(UA.firefoxWindows), 'browser');
    assert.equal(clientKindFromUserAgent(UA.okhttpAndroid), 'android');
    assert.equal(clientKindFromUserAgent(UA.curl), 'unknown');
    assert.equal(clientKindFromUserAgent(UA.chromeMac, { deviceName: ' Plenivo-App ', appDeviceNames: ['Plenivo-App'] }), 'app');
  });
});
