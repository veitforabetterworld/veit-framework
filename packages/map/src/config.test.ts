import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bindMapConfig, configureMap, getMapConfig } from './config.js';

describe('map config', () => {
  it('snaps each owner to its own values', () => {
    const before = getMapConfig();
    const left = {};
    const right = {};
    try {
      bindMapConfig(left, { terrain: { exaggeration: 2 } });
      bindMapConfig(right, { terrain: { exaggeration: 4 }, world3d: { traffic: false } });
      configureMap({ terrain: { exaggeration: 9 } });
      assert.equal(getMapConfig(left).terrain.exaggeration, 2);
      assert.equal(getMapConfig(right).terrain.exaggeration, 4);
      assert.equal(getMapConfig(right).world3d.traffic, false);
      assert.equal(getMapConfig(left).world3d.traffic, before.world3d.traffic);
      assert.equal(getMapConfig().terrain.exaggeration, 9);
    } finally {
      configureMap({
        terrain: { ...before.terrain },
        buildings3d: before.buildings3d,
        world3d: { ...before.world3d },
        overlayAnchors: before.overlayAnchors,
        topLayers: before.topLayers,
      });
    }
  });
});
