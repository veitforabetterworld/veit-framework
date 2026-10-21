import { PbfReader } from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import type { TileId } from './tileMath.js';

export type LngLatRing = [number, number][];

export type BuildingFeature = {
  rings: LngLatRing[];
  height: number;
  minHeight: number;
};

/** OSM leaf_type / natural, when the tile or a later stand match provides it. */
export type WoodLeaf = 'broadleaved' | 'needleleaved' | 'mixed' | 'scrub' | 'forest';

export type ClassifiedPoly = {
  rings: LngLatRing[];
  klass: string;
  leaf?: WoodLeaf;
};

export function woodLeafFromTags(className: string, subclass = ''): WoodLeaf | null {
  const blob = `${className} ${subclass}`.toLowerCase();
  if (/scrub|shrub|bush|hedge/.test(blob)) return 'scrub';
  if (/needle|conifer/.test(blob)) return 'needleleaved';
  if (/broad|deciduous/.test(blob)) return 'broadleaved';
  if (blob.includes('mixed')) return 'mixed';
  if (className === 'wood' || className === 'forest' || subclass === 'wood' || subclass === 'forest') return 'forest';
  return null;
}

/** OpenMapTiles landcover/landuse class+subclass → a ground-cover kind, or null. */
export function groundCoverKind(className: string, subclass = ''): string | null {
  const k = className.toLowerCase();
  const s = subclass.toLowerCase();
  if (/scrub|shrub|bush|hedge|wood|forest/.test(`${k} ${s}`)) return null;
  if (k === 'orchard' || s === 'orchard') return 'orchard';
  if (k === 'vineyard' || s === 'vineyard') return 'vineyard';
  if (k === 'farmyard' || s === 'farmyard') return 'grass';
  if (k === 'farmland' || k === 'farm' || k === 'crop' || s === 'farmland' || s === 'farm' || s === 'crop') return 'farm';
  if (k === 'allotments' || s === 'allotments') return 'allotment';
  if (k === 'garden' || s === 'garden') return 'garden';
  if (k === 'meadow' || s === 'meadow') return 'meadow';
  if (k === 'park' || s === 'park' || k === 'recreation_ground' || s === 'recreation_ground') return 'park';
  if (k === 'grass' || k === 'grassland' || s === 'grass' || s === 'grassland') return 'grass';
  return null;
}

export type LineFeature = {
  line: LngLatRing;
  klass: string;
  subclass?: string;
  surface?: string;
  brunnel?: string;
  service?: string;
  /** 1 along the line, -1 against it, 0 both ways. */
  oneway?: -1 | 0 | 1;
  stack?: number;
  /** OSM access, OpenMapTiles values such as no or private. */
  access?: string;
  /** OSM bicycle: yes, designated or no. */
  bicycle?: string;
  /** OSM foot: yes, designated or no. */
  foot?: string;
  /** OpenMapTiles ramp=1: motorway or trunk link. */
  ramp?: boolean;
};

export type ParsedOsmTile = {
  buildings: BuildingFeature[];
  woods: ClassifiedPoly[];
  grasses: ClassifiedPoly[];
  waters: ClassifiedPoly[];
  waterways: LineFeature[];
  roads: LineFeature[];
};

const TILEJSON = 'https://tiles.openfreemap.org/planet';

let tileUrlTemplate: string | null = null;

async function mvtUrl(tile: TileId): Promise<string> {
  if (!tileUrlTemplate) {
    const res = await fetch(TILEJSON);
    if (!res.ok) throw new Error(`OpenFreeMap tilejson ${res.status}`);
    const spec = (await res.json()) as { tiles?: string[] };
    tileUrlTemplate = spec.tiles?.[0] ?? 'https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf';
  }
  return tileUrlTemplate
    .replace('{z}', String(tile.z))
    .replace('{x}', String(tile.x))
    .replace('{y}', String(tile.y));
}

function asLngLat(pt: unknown): [number, number] | null {
  if (!Array.isArray(pt) || pt.length < 2) return null;
  const lng = Number(pt[0]);
  const lat = Number(pt[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}

function ringsFromGeometry(geometry: { type: string; coordinates: unknown }): LngLatRing[] {
  const convertRing = (ring: unknown): LngLatRing => {
    if (!Array.isArray(ring)) return [];
    const out: LngLatRing = [];
    for (const pt of ring) {
      const pair = asLngLat(pt);
      if (pair) out.push(pair);
    }
    return out;
  };
  if (geometry.type === 'Polygon') {
    return (geometry.coordinates as unknown[]).map(convertRing).filter((r) => r.length >= 3);
  }
  if (geometry.type === 'MultiPolygon') {
    const out: LngLatRing[] = [];
    for (const poly of geometry.coordinates as unknown[]) {
      if (!Array.isArray(poly)) continue;
      for (const ring of poly) {
        const converted = convertRing(ring);
        if (converted.length >= 3) out.push(converted);
      }
    }
    return out;
  }
  return [];
}

function linesFromGeometry(geometry: { type: string; coordinates: unknown }): LngLatRing[] {
  const convert = (line: unknown): LngLatRing => {
    if (!Array.isArray(line)) return [];
    const out: LngLatRing = [];
    for (const pt of line) {
      const pair = asLngLat(pt);
      if (pair) out.push(pair);
    }
    return out;
  };
  if (geometry.type === 'LineString') return [convert(geometry.coordinates)].filter((l) => l.length >= 2);
  if (geometry.type === 'MultiLineString') {
    return (geometry.coordinates as unknown[]).map(convert).filter((l) => l.length >= 2);
  }
  return [];
}

function buildingHeight(props: Record<string, unknown>): { height: number; minHeight: number } {
  const h = Number(props.render_height ?? props.height ?? 0);
  const levels = Number(props.render_levels ?? props['building:levels'] ?? 0);
  const height = h > 1 ? h : levels > 0 ? levels * 3.2 : 8;
  const minH = Number(props.render_min_height ?? props.min_height ?? 0);
  return { height: Math.min(80, Math.max(3, height)), minHeight: Number.isFinite(minH) ? Math.max(0, minH) : 0 };
}

/** Layers the three.js scene never reads stay unparsed. MapLibre draws buildings and water itself. */
export type ParseOptions = {
  buildings?: boolean;
  grasses?: boolean;
  waters?: boolean;
  waterways?: boolean;
};

export function parseOsmTileBuffer(tile: TileId, buf: Uint8Array, opts: ParseOptions = {}): ParsedOsmTile {
  const want = { buildings: true, grasses: true, waters: true, waterways: true, ...opts };
  const vt = new VectorTile(new PbfReader(buf));
  const parsed: ParsedOsmTile = {
    buildings: [],
    woods: [],
    grasses: [],
    waters: [],
    waterways: [],
    roads: [],
  };

  const buildingLayer = want.buildings ? vt.layers.building : undefined;
  if (buildingLayer) {
    for (let i = 0; i < buildingLayer.length; i++) {
      const feat = buildingLayer.feature(i);
      const geom = feat.toGeoJSON(tile.x, tile.y, tile.z);
      const rings = ringsFromGeometry(geom.geometry as { type: string; coordinates: unknown });
      if (!rings.length) continue;
      const { height, minHeight } = buildingHeight(feat.properties as Record<string, unknown>);
      parsed.buildings.push({ rings, height, minHeight });
    }
  }

  const landcover = vt.layers.landcover;
  if (landcover) {
    for (let i = 0; i < landcover.length; i++) {
      const feat = landcover.feature(i);
      const props = feat.properties as { class?: string; subclass?: string };
      const klass = String(props.class ?? '');
      const subclass = String(props.subclass ?? '');
      const geom = feat.toGeoJSON(tile.x, tile.y, tile.z);
      const rings = ringsFromGeometry(geom.geometry as { type: string; coordinates: unknown });
      if (!rings.length) continue;
      const leaf = woodLeafFromTags(klass, subclass);
      if (leaf === 'scrub') parsed.woods.push({ rings, klass: 'scrub', leaf });
      else if (leaf) parsed.woods.push({ rings, klass: 'wood', leaf });
      else if (want.grasses) {
        const ground = groundCoverKind(klass, subclass);
        if (ground) parsed.grasses.push({ rings, klass: ground });
      }
    }
  }

  const landuse = vt.layers.landuse;
  if (landuse) {
    for (let i = 0; i < landuse.length; i++) {
      const feat = landuse.feature(i);
      const props = feat.properties as { class?: string; subclass?: string };
      const klass = String(props.class ?? '');
      const subclass = String(props.subclass ?? '');
      const geom = feat.toGeoJSON(tile.x, tile.y, tile.z);
      const rings = ringsFromGeometry(geom.geometry as { type: string; coordinates: unknown });
      if (!rings.length) continue;
      const leaf = woodLeafFromTags(klass, subclass);
      if (leaf === 'scrub') parsed.woods.push({ rings, klass: 'scrub', leaf });
      else if (leaf) parsed.woods.push({ rings, klass: 'wood', leaf });
      const ground = want.grasses ? groundCoverKind(klass, subclass) : null;
      if (ground) parsed.grasses.push({ rings, klass: ground });
    }
  }

  const water = want.waters ? vt.layers.water : undefined;
  if (water) {
    for (let i = 0; i < water.length; i++) {
      const feat = water.feature(i);
      const geom = feat.toGeoJSON(tile.x, tile.y, tile.z);
      const rings = ringsFromGeometry(geom.geometry as { type: string; coordinates: unknown });
      if (rings.length) parsed.waters.push({ rings, klass: 'water' });
    }
  }

  const waterway = want.waterways ? vt.layers.waterway : undefined;
  if (waterway) {
    for (let i = 0; i < waterway.length; i++) {
      const feat = waterway.feature(i);
      const geom = feat.toGeoJSON(tile.x, tile.y, tile.z);
      const lines = linesFromGeometry(geom.geometry as { type: string; coordinates: unknown });
      const klass = String((feat.properties as { class?: string }).class ?? 'stream');
      for (const line of lines) parsed.waterways.push({ line, klass });
    }
  }

  const transport = vt.layers.transportation;
  if (transport) {
    for (let i = 0; i < transport.length; i++) {
      const feat = transport.feature(i);
      const geom = feat.toGeoJSON(tile.x, tile.y, tile.z);
      const lines = linesFromGeometry(geom.geometry as { type: string; coordinates: unknown });
      const props = feat.properties as Record<string, unknown>;
      const rawWay = props.oneway;
      const oneway: -1 | 0 | 1 =
        rawWay === -1 || rawWay === '-1' ? -1 : rawWay === 1 || rawWay === '1' || rawWay === true || rawWay === 'yes' ? 1 : 0;
      const stack = Number(props.layer ?? 0);
      for (const line of lines) {
        parsed.roads.push({
          line,
          klass: String(props.class ?? 'minor'),
          subclass: props.subclass ? String(props.subclass) : undefined,
          surface: props.surface ? String(props.surface) : undefined,
          brunnel: props.brunnel ? String(props.brunnel) : undefined,
          service: props.service ? String(props.service) : undefined,
          oneway,
          stack: Number.isFinite(stack) ? stack : 0,
          access: props.access ? String(props.access) : undefined,
          bicycle: props.bicycle ? String(props.bicycle) : undefined,
          foot: props.foot ? String(props.foot) : undefined,
          ramp: props.ramp === 1 || props.ramp === '1' || props.ramp === true,
        });
      }
    }
  }

  return parsed;
}

export async function fetchMvtBuffer(tile: TileId): Promise<ArrayBuffer> {
  const url = await mvtUrl(tile);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MVT ${tile.z}/${tile.x}/${tile.y} ${res.status}`);
  return res.arrayBuffer();
}

export async function fetchParsedOsmTile(tile: TileId): Promise<ParsedOsmTile> {
  const buf = new Uint8Array(await fetchMvtBuffer(tile));
  return parseOsmTileBuffer(tile, buf);
}
