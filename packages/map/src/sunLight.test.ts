import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lightPositionForSun, subsolarPoint } from './sunLight.js';

describe('subsolarPoint', () => {
  it('stands near the equator at the March equinox noon UTC', () => {
    const { lat, lng } = subsolarPoint(new Date('2026-03-20T12:00:00Z'));
    assert.ok(Math.abs(lat) < 1, `lat ${lat}`);
    assert.ok(Math.abs(lng) < 5, `lng ${lng}`);
  });

  it('reaches the tropic at the June solstice', () => {
    const { lat } = subsolarPoint(new Date('2026-06-21T12:00:00Z'));
    assert.ok(Math.abs(lat - 23.44) < 0.3, `lat ${lat}`);
  });

  it('moves 15 degrees west per hour', () => {
    const a = subsolarPoint(new Date('2026-10-21T06:00:00Z'));
    const b = subsolarPoint(new Date('2026-10-21T07:00:00Z'));
    assert.ok(Math.abs(a.lng - b.lng - 15) < 0.1, `${a.lng} -> ${b.lng}`);
  });
});

describe('lightPositionForSun', () => {
  it('puts a sun above 0/0 straight up', () => {
    const [radial, , polar] = lightPositionForSun(0, 0);
    assert.equal(radial, 1);
    assert.ok(polar < 1e-6);
  });

  it('puts a sun at 90 degrees east on the horizon in the east', () => {
    const [, azimuth, polar] = lightPositionForSun(0, 90);
    assert.ok(Math.abs(azimuth - 90) < 1e-6);
    assert.ok(Math.abs(polar - 90) < 1e-6);
  });
});
