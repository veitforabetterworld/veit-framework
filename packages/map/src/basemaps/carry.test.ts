import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { StyleSpecification } from 'maplibre-gl';
import { carryHostStyle } from './controller.js';

function style(layers: StyleSpecification['layers'], sources: StyleSpecification['sources'] = {}): StyleSpecification {
  return { version: 8, sources, layers };
}

describe('carryHostStyle', () => {
  const owned = { layers: new Set(['base']), sources: new Set(['base']) };
  const next = style([{ id: 'base', type: 'background' }], { base: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } });

  it('keeps host layers and sources and drops custom layers', () => {
    const previous = style(
      [
        { id: 'base', type: 'background' },
        { id: 'stations', type: 'circle', source: 'stations' },
        { id: 'osm-world-3d', type: 'custom' } as unknown as StyleSpecification['layers'][number],
      ],
      {
        base: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
        stations: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      },
    );
    previous.terrain = { source: 'dem', exaggeration: 1.15 };
    const carried = carryHostStyle(previous, next, owned);
    assert.deepEqual(
      carried.style.layers.map((layer) => layer.id),
      ['base', 'stations'],
    );
    assert.ok(carried.style.sources.stations);
    assert.equal(carried.style.terrain?.exaggeration, 1.15);
    assert.equal(carried.own.layers.has('osm-world-3d'), false);
  });

  it('does not copy a host layer the next style already owns', () => {
    const previous = style(
      [
        { id: 'base', type: 'background' },
        { id: 'stations', type: 'circle', source: 'stations' },
      ],
      { stations: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } },
    );
    const incoming = style(
      [
        { id: 'base', type: 'background' },
        { id: 'stations', type: 'circle', source: 'stations' },
      ],
      { stations: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } },
    );
    const carried = carryHostStyle(previous, incoming, owned);
    assert.deepEqual(
      carried.style.layers.map((layer) => layer.id),
      ['base', 'stations'],
    );
  });
});
