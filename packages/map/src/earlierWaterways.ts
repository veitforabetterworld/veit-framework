import { VectorTile } from '@mapbox/vector-tile';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { PbfReader } from 'pbf';

const SOURCE_ID = 'waterway-extra';
const DETAIL_LAYER = 'waterway-detail';
const STREAM_LAYER = 'waterway-streams';
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const hooked = new WeakSet<MapLibreMap>();

const DETAIL_WIDTH: unknown[] = [
  'interpolate',
  ['exponential', 1.4],
  ['zoom'],
  6,
  ['match', ['get', 'class'], 'river', 1.6, 'canal', 1.2, 0.7],
  9,
  ['match', ['get', 'class'], 'river', 2.8, 'canal', 2, 1.2],
];

const STREAM_WIDTH: unknown[] = [
  'interpolate',
  ['exponential', 1.4],
  ['zoom'],
  10,
  0.9,
  13,
  1.7,
];

type TileId = { z: number; x: number; y: number };

function latToTileY(lat: number, z: number): number {
  const n = 2 ** z;
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
}

function tilesFor(map: MapLibreMap, z: number, limit: number): TileId[] {
  const b = map.getBounds();
  const n = 2 ** z;
  let x0 = Math.floor(((b.getWest() + 180) / 360) * n);
  let x1 = Math.floor(((b.getEast() + 180) / 360) * n);
  let y0 = latToTileY(b.getNorth(), z);
  let y1 = latToTileY(b.getSouth(), z);
  x0 = Math.max(0, x0);
  x1 = Math.min(n - 1, x1);
  y0 = Math.max(0, y0);
  y1 = Math.min(n - 1, y1);
  const tiles: TileId[] = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) tiles.push({ z, x, y });
  }
  if (tiles.length <= limit) return tiles;
  const c = map.getCenter();
  const cx = ((c.lng + 180) / 360) * n;
  const cy = latToTileY(c.lat, z) + 0.5;
  tiles.sort((a, b) => (a.x - cx) ** 2 + (a.y - cy) ** 2 - ((b.x - cx) ** 2 + (b.y - cy) ** 2));
  return tiles.slice(0, limit);
}

function bandFor(zoom: number): { z: number; classes: string[] | null } | null {
  if (zoom >= 7 && zoom < 9) return { z: 9, classes: null };
  if (zoom >= 10 && zoom < 13) return { z: 13, classes: ['stream', 'ditch', 'drain'] };
  return null;
}

async function tileTemplate(map: MapLibreMap): Promise<string | null> {
  const source = map.getSource('openmaptiles') as { tiles?: string[]; url?: string } | undefined;
  if (!source) return null;
  if (source.tiles && source.tiles.length > 0) return source.tiles[0]!;
  if (!source.url) return null;
  const body = (await fetch(source.url).then((res) => res.json())) as { tiles?: string[] };
  return body.tiles?.[0] ?? null;
}

async function readWaterways(template: string, tile: TileId, classes: string[] | null): Promise<GeoJSON.Feature[]> {
  const url = template.replace('{z}', String(tile.z)).replace('{x}', String(tile.x)).replace('{y}', String(tile.y));
  const res = await fetch(url);
  if (!res.ok) return [];
  const buf = new Uint8Array(await res.arrayBuffer());
  const layer = new VectorTile(new PbfReader(buf)).layers.waterway;
  if (!layer) return [];
  const features: GeoJSON.Feature[] = [];
  for (let i = 0; i < layer.length; i++) {
    const feat = layer.feature(i);
    const klass = String((feat.properties as { class?: string }).class ?? '');
    if (classes && !classes.includes(klass)) continue;
    const gj = feat.toGeoJSON(tile.x, tile.y, tile.z) as GeoJSON.Feature;
    gj.properties = { class: klass };
    features.push(gj);
  }
  return features;
}

function labelAnchor(map: MapLibreMap): string | undefined {
  for (const id of ['water_name', 'waterway_line_label', 'water_name_line_label', 'place_city']) {
    if (map.getLayer(id)) return id;
  }
  return undefined;
}

function ensureLayers(map: MapLibreMap, color: string): void {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: 'geojson', data: EMPTY });
  }
  const before = labelAnchor(map);
  if (!map.getLayer(DETAIL_LAYER)) {
    map.addLayer(
      {
        id: DETAIL_LAYER,
        type: 'line',
        source: SOURCE_ID,
        minzoom: 7,
        maxzoom: 9,
        filter: ['!', ['match', ['get', 'class'], ['stream', 'ditch', 'drain'], true, false]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': color,
          'line-width': DETAIL_WIDTH as never,
          'line-opacity': 1,
        },
      },
      before,
    );
  } else {
    map.setPaintProperty(DETAIL_LAYER, 'line-color', color);
  }
  if (!map.getLayer(STREAM_LAYER)) {
    map.addLayer(
      {
        id: STREAM_LAYER,
        type: 'line',
        source: SOURCE_ID,
        minzoom: 10,
        maxzoom: 13,
        filter: ['match', ['get', 'class'], ['stream', 'ditch', 'drain'], true, false],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': color,
          'line-width': STREAM_WIDTH as never,
          'line-opacity': 0.95,
        },
      },
      before,
    );
  } else {
    map.setPaintProperty(STREAM_LAYER, 'line-color', color);
  }
}

/**
 * OpenMapTiles only ship medium rivers from z9 and brooks from z13.
 * Below those zooms, draw the higher tile into the current view.
 */
export function attachEarlierWaterways(map: MapLibreMap, color: string): void {
  ensureLayers(map, color);
  if (hooked.has(map)) return;
  hooked.add(map);
  let seq = 0;
  let template: string | null = null;
  let timer = 0;
  const refresh = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(load, 200);
  };
  const load = () => {
    const band = bandFor(map.getZoom());
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!src) return;
    if (!band) {
      src.setData(EMPTY);
      return;
    }
    const ticket = ++seq;
    const tiles = tilesFor(map, band.z, band.z === 9 ? 40 : 64);
    void (async () => {
      template ??= await tileTemplate(map);
      if (!template || ticket !== seq) return;
      const groups = await Promise.all(tiles.map((tile) => readWaterways(template!, tile, band.classes).catch(() => [])));
      if (ticket !== seq || !map.getSource(SOURCE_ID)) return;
      const features = groups.flat();
      src.setData({ type: 'FeatureCollection', features });
    })();
  };
  map.on('moveend', refresh);
  refresh();
}
