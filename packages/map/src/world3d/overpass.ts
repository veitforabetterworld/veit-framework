import * as THREE from 'three';
import { getMapConfig } from '../config.js';
import type { LngLatRing, WoodLeaf } from './mvt.js';
import { disposeObject3D, fenceAlong, hedgeAlong, leafFromOsmTags, loneTree } from './osmTileScene.js';
import { buildPowerGroup } from './powerLines.js';
import type { WorldOrigin } from './lngLat.js';

const OVERPASS = 'https://overpass-api.de/api/interpreter';

type OverpassEl = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};

function clampBbox(
  west: number,
  south: number,
  east: number,
  north: number,
): [number, number, number, number] {
  const midLng = (west + east) / 2;
  const midLat = (south + north) / 2;
  const maxSpan = 0.012;
  const w = Math.min(east - west, maxSpan);
  const h = Math.min(north - south, maxSpan);
  return [midLng - w / 2, midLat - h / 2, midLng + w / 2, midLat + h / 2];
}

export type LeafStand = { rings: LngLatRing[]; leaf: WoodLeaf };

let overpassActive = 0;
const overpassQueue: Array<() => void> = [];

function overpassSlot<T>(work: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      overpassActive += 1;
      work().then(resolve, reject).finally(() => {
        overpassActive -= 1;
        overpassQueue.shift()?.();
      });
    };
    if (overpassActive < 2) run();
    else overpassQueue.push(run);
  });
}

/** Forest stands tagged with leaf_type, plus scrub polygons. One shot per tile, not per pan. */
export function fetchLeafStands(west: number, south: number, east: number, north: number): Promise<LeafStand[]> {
  const q = `[out:json][timeout:8][bbox:${south},${west},${north},${east}];(way["landuse"="forest"]["leaf_type"];way["natural"="wood"]["leaf_type"];way["natural"="scrub"];);out geom;`;
  return overpassSlot(async () => {
    const res = await fetch(OVERPASS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: `data=${encodeURIComponent(q)}`,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { elements?: OverpassEl[] };
    const stands: LeafStand[] = [];
    for (const el of json.elements ?? []) {
      if (!el.geometry || el.geometry.length < 3) continue;
      const ring: LngLatRing = el.geometry.map((p) => [p.lon, p.lat]);
      const leaf = el.tags?.natural === 'scrub' ? 'scrub' : leafFromOsmTags(el.tags);
      if (leaf === 'forest' && el.tags?.natural !== 'scrub') continue;
      stands.push({ rings: [ring], leaf });
    }
    return stands;
  });
}

type OsmDetail = {
  barriers: { kind: 'hedge' | 'fence'; line: [number, number][] }[];
  trees: { lng: number; lat: number; tags?: Record<string, string> }[];
  rows: { line: [number, number][]; tags?: Record<string, string> }[];
  powerNodes?: {
    lng: number;
    lat: number;
    kind: 'tower' | 'pole';
    material?: string;
    design?: string;
    attachment?: string;
    height?: number;
  }[];
  powerLines?: { kind: 'line' | 'minor'; cables?: number; voltage?: number; line: [number, number][] }[];
};

async function fetchOsmDetail(bbox: [number, number, number, number]): Promise<OsmDetail> {
  const detailUrl = getMapConfig().world3d.detailUrl;
  if (!detailUrl) return { barriers: [], trees: [], rows: [] };
  const res = await fetch(detailUrl(bbox));
  if (!res.ok) throw new Error(`barriers ${res.status}`);
  return (await res.json()) as OsmDetail;
}

function detailKey(west: number, south: number, east: number, north: number, zoom: number): string {
  if (zoom < 14) return '';
  const midLng = (west + east) / 2;
  const midLat = (south + north) / 2;
  const lng = Math.round(midLng / 0.008) * 0.008;
  const lat = Math.round(midLat / 0.006) * 0.006;
  return `${lng.toFixed(4)},${lat.toFixed(4)}`;
}

export class DetailLod {
  readonly group = new THREE.Group();
  private lastKey = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;
  private retries = 0;
  private buildWorld: WorldOrigin | null = null;

  /** Meshes built after a recenter use the camera origin, not the one captured when the fetch started. */
  useOrigin(world: WorldOrigin): void {
    this.buildWorld = world;
  }

  constructor(
    private sampleAlt: (lng: number, lat: number) => number,
    private onChange?: () => void,
  ) {}

  schedule(west: number, south: number, east: number, north: number, zoom: number, world: WorldOrigin): void {
    if (this.timer) clearTimeout(this.timer);
    if (zoom < 14) {
      this.clear();
      return;
    }
    this.retries = 0;
    this.timer = setTimeout(() => {
      void this.load(west, south, east, north, zoom, world);
    }, 450);
  }

  private async load(west: number, south: number, east: number, north: number, zoom: number, world: WorldOrigin): Promise<void> {
    const bbox = clampBbox(west, south, east, north);
    const key = detailKey(west, south, east, north, zoom);
    if (key === this.lastKey) return;
    const seq = ++this.seq;
    this.lastKey = key;
    try {
      const detail = await fetchOsmDetail(bbox);
      if (seq !== this.seq) return;
      world = this.buildWorld ?? world;
      this.retries = 0;
      this.clearMeshes();
      let placed = 0;
      for (const item of detail.barriers ?? []) {
        if (item.kind === 'hedge') {
          const mesh = hedgeAlong(item.line, this.sampleAlt, world);
          if (mesh) {
            this.group.add(mesh);
            placed += 1;
          }
        } else {
          const fence = fenceAlong(item.line, this.sampleAlt, world);
          if (fence.children.length) {
            this.group.add(fence);
            placed += 1;
          }
        }
      }
      for (const tree of detail.trees ?? []) {
        const alt = this.sampleAlt(tree.lng, tree.lat);
        if (!Number.isFinite(alt)) continue;
        const height = Number(tree.tags?.height);
        this.group.add(
          loneTree(
            tree.lng,
            tree.lat,
            alt,
            `t${tree.lng.toFixed(5)}:${tree.lat.toFixed(5)}`,
            world,
            leafFromOsmTags(tree.tags),
            Number.isFinite(height) ? height : undefined,
          ),
        );
        placed += 1;
      }
      for (const row of detail.rows ?? []) {
        const line = row.line;
        if (line.length < 2) continue;
        const leaf = leafFromOsmTags(row.tags);
        let remain = 0;
        for (let i = 0; i < line.length - 1; i++) {
          const [lng0, lat0] = line[i]!;
          const [lng1, lat1] = line[i + 1]!;
          const mx = 111320 * Math.cos((lat0 * Math.PI) / 180);
          const len = Math.hypot((lng1 - lng0) * mx, (lat1 - lat0) * 111320);
          const steps = Math.max(1, Math.floor((remain + len) / 8));
          for (let s = 0; s < steps; s++) {
            const t = ((s + 1) * 8 - remain) / len;
            if (t < 0 || t > 1) continue;
            const lng = lng0 + (lng1 - lng0) * t;
            const lat = lat0 + (lat1 - lat0) * t;
            const alt = this.sampleAlt(lng, lat);
            if (!Number.isFinite(alt)) continue;
            this.group.add(loneTree(lng, lat, alt, `row${lng.toFixed(5)}:${lat.toFixed(5)}`, world, leaf));
            placed += 1;
          }
          remain = (remain + len) % 8;
        }
      }
      const power = buildPowerGroup(detail.powerNodes ?? [], detail.powerLines ?? [], this.sampleAlt, world);
      if (power) {
        this.group.add(power);
        placed += 1;
      }
      const wanted =
        (detail.barriers?.length ?? 0) +
        (detail.trees?.length ?? 0) +
        (detail.rows?.length ?? 0) +
        (detail.powerNodes?.length ?? 0) +
        (detail.powerLines?.length ?? 0);
      if (wanted > 0 && placed === 0) {
        this.lastKey = '';
        throw new Error('terrain');
      }
      this.onChange?.();
    } catch {
      if (seq !== this.seq) return;
      this.lastKey = '';
      if (this.retries >= 2) return;
      this.retries += 1;
      this.timer = setTimeout(() => {
        void this.load(west, south, east, north, zoom, world);
      }, 2200);
    }
  }

  private clearMeshes(): void {
    const keep = [...this.group.children];
    for (const child of keep) {
      this.group.remove(child);
      disposeObject3D(child);
    }
  }

  clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.lastKey = '';
    this.clearMeshes();
  }

  dispose(): void {
    this.clear();
  }
}
