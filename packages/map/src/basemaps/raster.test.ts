import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILTIN_BASEMAPS } from './builtin.js';
import { rasterBasemap } from './raster.js';

describe('rasterBasemap', () => {
  const def = rasterBasemap({
    id: 'landuse',
    label: 'Bodennutzung',
    tiles: 'https://example.test/{z}/{x}/{y}.png',
    maxzoom: 19,
    attribution: '© Test',
  });

  it('wraps the tiles in an inline style with glyphs for host symbol layers', () => {
    const style = def.style('dark');
    assert.equal(typeof style, 'object');
    if (typeof style === 'string') return;
    assert.ok(style.glyphs?.includes('{fontstack}'));
    assert.deepEqual(
      style.layers.map((l) => l.id),
      ['bm-landuse-background', 'bm-landuse'],
    );
  });
});

describe('built-in basemaps', () => {
  it('has unique ids and a label for each', () => {
    const ids = BUILTIN_BASEMAPS.map((b) => b.id);
    assert.deepEqual(ids, ['osm', 'satellite', 'topo', 'official', 'cadastral']);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(BUILTIN_BASEMAPS.every((b) => b.label && b.attribution));
  });

  it('prefers vector styles where they exist', () => {
    const byId = Object.fromEntries(BUILTIN_BASEMAPS.map((b) => [b.id, b.style('light')]));
    assert.equal(typeof byId.osm, 'string');
    assert.equal(typeof byId.official, 'string');
    assert.equal(typeof byId.cadastral, 'string');
  });

  it('draws satellite labels as a vector overlay', () => {
    const style = BUILTIN_BASEMAPS.find((b) => b.id === 'satellite')?.style('dark');
    assert.ok(style && typeof style !== 'string');
    if (!style || typeof style === 'string') return;
    assert.equal(style.sources.openmaptiles?.type, 'vector');
    assert.ok(style.layers.some((l) => l.id === 'overlay_label_city'));
  });
});
