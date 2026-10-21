import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { elevationProfile } from './elevationProfile.js';

function fakeMap(elevation: (lng: number, lat: number) => number | null): MapLibreMap {
  return {
    queryTerrainElevation: ({ lng, lat }: { lng: number; lat: number }) => elevation(lng, lat),
  } as unknown as MapLibreMap;
}

describe('elevationProfile', () => {
  const line: [number, number][] = [
    [8, 50],
    [9, 50],
  ];

  it('samples evenly along the line and keeps the end points', () => {
    const profile = elevationProfile(fakeMap((lng) => lng * 100), line, { samples: 5 });
    assert.equal(profile.length, 5);
    assert.equal(profile[0].distance, 0);
    assert.ok(Math.abs(profile[0].lng - 8) < 1e-9);
    assert.ok(Math.abs(profile[4].lng - 9) < 1e-9);
    // 1 degree of longitude at 50 N is about 71.5 km
    assert.ok(Math.abs(profile[4].distance - 71_500) < 500, `${profile[4].distance}`);
    assert.ok(profile.every((p, i) => i === 0 || p.distance > profile[i - 1].distance));
  });

  it('reports null where no terrain is loaded', () => {
    const profile = elevationProfile(fakeMap(() => null), line, { samples: 3 });
    assert.deepEqual(
      profile.map((p) => p.elevation),
      [null, null, null],
    );
  });

  it('returns nothing for a single point', () => {
    assert.deepEqual(elevationProfile(fakeMap(() => 0), [[8, 50]]), []);
  });
});
