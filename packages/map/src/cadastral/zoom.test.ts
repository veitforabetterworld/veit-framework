import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  maxZoomForMinScale,
  minZoomForMaxScale,
} from './zoom.js';

describe('mapCadastralZoom', () => {
  it('converts Berlin ALKIS raster scale limits', () => {
    assert.equal(minZoomForMaxScale(2550), 18);
    assert.equal(maxZoomForMinScale(200), 20);
  });

  it('converts Brandenburg parcel scale limit', () => {
    assert.equal(minZoomForMaxScale(10_000), 16);
  });

  it('converts Bremen ALKIS scale limit', () => {
    assert.equal(minZoomForMaxScale(5000), 17);
  });

  it('converts NRW parcel scale limit', () => {
    assert.equal(minZoomForMaxScale(5501), 17);
  });

  it('converts RP parcel scale limit', () => {
    assert.equal(minZoomForMaxScale(7500), 16);
  });

  it('converts Hamburg parcel and overview scale limits', () => {
    assert.equal(minZoomForMaxScale(9543), 16);
    assert.equal(minZoomForMaxScale(28_349), 14);
  });
});
