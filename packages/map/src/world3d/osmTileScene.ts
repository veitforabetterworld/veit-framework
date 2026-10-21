import * as THREE from 'three';
import { hash01, hash2 } from './hash.js';
import {
  enu,
  enuMapper,
  pointInRing,
  ringAreaM2,
  ringBbox,
  yUpEnuMatrix,
  type WorldOrigin,
} from './lngLat.js';
import type { ClassifiedPoly, LngLatRing, ParsedOsmTile, WoodLeaf } from './mvt.js';
import { powerSharedGeometries, powerSharedMaterials } from './powerLines.js';
import { roadSharedGeometries, roadSharedMaterials } from './roads.js';
import { tileKey, type TileId } from './tileMath.js';

/** Fixed lattice. Jitter and gaps keep it from looking like a plantation. */
const TREE_SPACING_M = 8;
const TREE_KEEP = 0.78;
const TREE_CAP_PER_TILE = 20000;
const MIN_WOOD_M2 = 40;

function markSceneObject(obj: THREE.Object3D): void {
  obj.frustumCulled = true;
  if (!(obj instanceof THREE.InstancedMesh) || obj.count < 1) return;
  const arr = obj.instanceMatrix.array as Float32Array;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < obj.count; i++) {
    const o = i * 16;
    const x = arr[o + 12] ?? 0;
    const y = arr[o + 13] ?? 0;
    const z = arr[o + 14] ?? 0;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  obj.boundingSphere = new THREE.Sphere(
    new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2),
    0.5 * Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) + 36,
  );
}

/** Nearby samples share one terrain lookup. The cell is a few meters across. */
function mergeColored(parts: Array<{ geom: THREE.BufferGeometry; color: [number, number, number] }>): THREE.BufferGeometry {
  let vCount = 0;
  let iCount = 0;
  for (const part of parts) {
    vCount += part.geom.attributes.position!.count;
    iCount += part.geom.index?.count ?? part.geom.attributes.position!.count;
  }
  const pos = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  const idx = new Uint32Array(iCount);
  let vo = 0;
  let io = 0;
  let vBase = 0;
  for (const part of parts) {
    const p = part.geom.attributes.position!.array as Float32Array;
    pos.set(p, vo);
    const n = p.length / 3;
    for (let i = 0; i < n; i++) {
      col[(vBase + i) * 3] = part.color[0];
      col[(vBase + i) * 3 + 1] = part.color[1];
      col[(vBase + i) * 3 + 2] = part.color[2];
    }
    const srcIdx = part.geom.index?.array;
    if (srcIdx) {
      for (let i = 0; i < srcIdx.length; i++) idx[io + i] = Number(srcIdx[i]) + vBase;
      io += srcIdx.length;
    }
    vo += p.length;
    vBase += n;
    part.geom.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
  merged.setIndex(new THREE.BufferAttribute(idx, 1));
  merged.computeVertexNormals();
  snapBaseToOrigin(merged);
  return merged;
}

function snapBaseToOrigin(geom: THREE.BufferGeometry): void {
  geom.computeBoundingBox();
  const minY = geom.boundingBox?.min.y;
  if (minY == null || Math.abs(minY) < 1e-4) return;
  geom.translate(0, -minY, 0);
}

function coniferGeometry(leaf: [number, number, number], tip: [number, number, number]): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.22, 0.38, 6.2, 6);
  trunk.translate(0, 3.1, 0);
  const lower = new THREE.ConeGeometry(3.4, 9.2, 8);
  lower.translate(0, 8.4, 0);
  const mid = new THREE.ConeGeometry(2.45, 7.4, 8);
  mid.translate(0, 12.6, 0);
  const upper = new THREE.ConeGeometry(1.25, 4.6, 7);
  upper.translate(0, 16.4, 0);
  return mergeColored([
    { geom: trunk, color: [0.34, 0.2, 0.1] },
    { geom: lower, color: leaf },
    { geom: mid, color: tip },
    { geom: upper, color: tip },
  ]);
}

function broadleafGeometry(leaf: [number, number, number], highlight: [number, number, number]): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.28, 0.46, 5.4, 6);
  trunk.translate(0, 2.7, 0);
  const crown = new THREE.SphereGeometry(4.6, 7, 6);
  crown.scale(1, 0.82, 1);
  crown.translate(0, 9.2, 0);
  const side = new THREE.SphereGeometry(2.8, 6, 5);
  side.translate(1.8, 8.4, 0.6);
  return mergeColored([
    { geom: trunk, color: [0.36, 0.22, 0.12] },
    { geom: crown, color: leaf },
    { geom: side, color: highlight },
  ]);
}

function bushGeometry(): THREE.BufferGeometry {
  const stem = new THREE.CylinderGeometry(0.08, 0.14, 0.7, 5);
  stem.translate(0, 0.35, 0);
  const a = new THREE.SphereGeometry(1.35, 6, 5);
  a.scale(1, 0.72, 1);
  a.translate(0, 1.35, 0);
  const b = new THREE.SphereGeometry(0.95, 6, 5);
  b.translate(0.7, 1.15, 0.35);
  return mergeColored([
    { geom: stem, color: [0.3, 0.2, 0.1] },
    { geom: a, color: [0.24, 0.42, 0.14] },
    { geom: b, color: [0.32, 0.48, 0.16] },
  ]);
}

const NEEDLE_A = coniferGeometry([0.1, 0.32, 0.14], [0.16, 0.4, 0.18]);
const NEEDLE_B = coniferGeometry([0.13, 0.28, 0.12], [0.08, 0.22, 0.1]);
const NEEDLE_C = coniferGeometry([0.18, 0.36, 0.2], [0.22, 0.42, 0.24]);
const BROAD_A = broadleafGeometry([0.22, 0.46, 0.14], [0.32, 0.55, 0.16]);
const BROAD_B = broadleafGeometry([0.16, 0.38, 0.1], [0.2, 0.44, 0.12]);
const BROAD_C = broadleafGeometry([0.34, 0.48, 0.12], [0.46, 0.52, 0.14]);
const SHARED_BUSH_GEOM = bushGeometry();
const SHARED_TREE_MAT = new THREE.MeshBasicMaterial({ vertexColors: true });

const TREE_GEOMS = {
  needleA: NEEDLE_A,
  needleB: NEEDLE_B,
  needleC: NEEDLE_C,
  broadA: BROAD_A,
  broadB: BROAD_B,
  broadC: BROAD_C,
  bush: SHARED_BUSH_GEOM,
} as const;
type TreeBucket = keyof typeof TREE_GEOMS;
const SHARED_GEOMS = new Set<THREE.BufferGeometry>([...Object.values(TREE_GEOMS)]);
const FENCE_POST_GEOM = new THREE.BoxGeometry(0.11, 1.25, 0.11);
FENCE_POST_GEOM.translate(0, 0.625, 0);
const FENCE_RAIL_GEOM = new THREE.BoxGeometry(1, 0.07, 0.045);
const FENCE_MAT = new THREE.MeshBasicMaterial({ color: 0x8d7b62 });
SHARED_GEOMS.add(FENCE_POST_GEOM);
SHARED_GEOMS.add(FENCE_RAIL_GEOM);
const SHARED_MATS = new Set<THREE.Material>([
  SHARED_TREE_MAT,
  FENCE_MAT,
  ...roadSharedMaterials,
  ...powerSharedMaterials,
]);
for (const geom of roadSharedGeometries) SHARED_GEOMS.add(geom);
for (const geom of powerSharedGeometries) SHARED_GEOMS.add(geom);

export function leafFromOsmTags(tags?: Record<string, string>): WoodLeaf {
  if (!tags) return 'forest';
  const leaf = `${tags.leaf_type ?? ''} ${tags.wood ?? ''}`.toLowerCase();
  if (/needle|conifer/.test(leaf)) return 'needleleaved';
  if (/broad|deciduous/.test(leaf)) return 'broadleaved';
  if (leaf.includes('mixed')) return 'mixed';
  const genus = `${tags.genus ?? ''} ${tags.species ?? ''} ${tags['species:de'] ?? ''}`.toLowerCase();
  if (/pinus|picea|abies|larix|pseudotsuga|fichte|kiefer|tanne|laerche|lärche/.test(genus)) return 'needleleaved';
  if (/quercus|fagus|betula|acer|fraxinus|carpinus|tilia|alnus|populus|eiche|buche|birke|ahorn|esche/.test(genus)) return 'broadleaved';
  if (tags.natural === 'scrub' || tags.natural === 'shrub') return 'scrub';
  return 'forest';
}

function instanced(
  geom: THREE.BufferGeometry,
  mat: THREE.MeshBasicMaterial,
  matrices: THREE.Matrix4[],
): THREE.InstancedMesh | null {
  if (!matrices.length) return null;
  const mesh = new THREE.InstancedMesh(geom, mat, matrices.length);
  for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i]!);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.sharedGeom = true;
  markSceneObject(mesh);
  return mesh;
}

function treeBucket(leaf: WoodLeaf | undefined, cell: string, ix: number, iy: number): TreeBucket {
  const roll = hash01(`${cell}:kind`);
  if (leaf === 'scrub') return 'bush';
  let needle = leaf === 'needleleaved';
  let broad = leaf === 'broadleaved';
  if (leaf === 'mixed' || leaf === 'forest' || !leaf) {
    const stand = hash01(`${Math.floor(ix / 7)}:${Math.floor(iy / 7)}:stand`);
    const dominant = stand < 0.4 ? 'broad' : stand < 0.72 ? 'needle' : 'mixed';
    if (dominant === 'mixed') needle = roll > 0.48;
    else if (dominant === 'needle') needle = roll < 0.82;
    else needle = roll > 0.82;
    broad = !needle;
  }
  if (leaf === 'needleleaved') needle = roll < 0.86;
  if (leaf === 'broadleaved') broad = roll < 0.86;
  const variant = hash01(`${cell}:var`);
  if (needle && !broad) return variant < 0.34 ? 'needleA' : variant < 0.67 ? 'needleB' : 'needleC';
  if (broad && !needle) return variant < 0.34 ? 'broadA' : variant < 0.67 ? 'broadB' : 'broadC';
  return roll < 0.5 ? (variant < 0.5 ? 'needleA' : 'needleC') : variant < 0.5 ? 'broadA' : 'broadC';
}

function treeScale(cell: string, bucket: TreeBucket): number {
  const h = hash01(`${cell}:s`);
  if (bucket === 'bush') return 0.85 + h * 1.15;
  if (h < 0.16) return 0.42 + h * 1.4;
  return 0.92 + (h - 0.16) * 1.05;
}

/** Terrain lookups are costly (queryTerrainElevation). Sample a ~25 m lattice and interpolate between its corners. */
const LATTICE_DEG = 0.0003;

function latticeSampler(
  sampleAlt: (lng: number, lat: number) => number,
): (lng: number, lat: number) => number {
  const cache = new Map<number, number>();
  const at = (i: number, j: number): number => {
    const key = i * 4194304 + j;
    let v = cache.get(key);
    if (v === undefined) {
      v = sampleAlt(i * LATTICE_DEG, j * LATTICE_DEG);
      cache.set(key, v);
    }
    return v;
  };
  return (lng, lat) => {
    const fx = lng / LATTICE_DEG;
    const fy = lat / LATTICE_DEG;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const a = at(i, j);
    const b = at(i + 1, j);
    const c = at(i, j + 1);
    const d = at(i + 1, j + 1);
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c) || !Number.isFinite(d)) return Number.NaN;
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
}

function treeBucketFast(leaf: WoodLeaf | undefined, ix: number, iy: number): TreeBucket {
  if (leaf === 'scrub') return 'bush';
  const roll = hash2(ix, iy, 1);
  let needle = leaf === 'needleleaved';
  let broad = leaf === 'broadleaved';
  if (leaf === 'mixed' || leaf === 'forest' || !leaf) {
    const stand = hash2(Math.floor(ix / 7), Math.floor(iy / 7), 2);
    const dominant = stand < 0.4 ? 'broad' : stand < 0.72 ? 'needle' : 'mixed';
    if (dominant === 'mixed') needle = roll > 0.48;
    else if (dominant === 'needle') needle = roll < 0.82;
    else needle = roll > 0.82;
    broad = !needle;
  }
  if (leaf === 'needleleaved') needle = roll < 0.86;
  if (leaf === 'broadleaved') broad = roll < 0.86;
  const variant = hash2(ix, iy, 3);
  if (needle && !broad) return variant < 0.34 ? 'needleA' : variant < 0.67 ? 'needleB' : 'needleC';
  if (broad && !needle) return variant < 0.34 ? 'broadA' : variant < 0.67 ? 'broadB' : 'broadC';
  return roll < 0.5 ? (variant < 0.5 ? 'needleA' : 'needleC') : variant < 0.5 ? 'broadA' : 'broadC';
}

function treeScaleFast(ix: number, iy: number, bucket: TreeBucket): number {
  const h = hash2(ix, iy, 6);
  if (bucket === 'bush') return 0.85 + h * 1.15;
  if (h < 0.16) return 0.42 + h * 1.4;
  return 0.92 + (h - 0.16) * 1.05;
}

type WoodCursor = {
  poly: ClassifiedPoly;
  outer: LngLatRing;
  east: number;
  north: number;
  dLng: number;
  dLat: number;
  startLng: number;
  lat: number;
};

/**
 * 8 m lattice over the wood polygons, jittered so it does not read as a plantation.
 * Resumable: `run(budgetMs)` places trees row by row and returns false until every polygon is done,
 * so a dense tile no longer blocks the main thread for seconds.
 */
export class WoodScatterJob {
  private readonly buckets = new Map<TreeBucket, number[]>();
  private readonly occupied = new Set<number>();
  private readonly alt: (lng: number, lat: number) => number;
  private readonly toLocal: ReturnType<typeof enuMapper>;
  private readonly p: [number, number, number] = [0, 0, 0];
  private placed = 0;
  private next = 0;
  private cursor: WoodCursor | null = null;

  constructor(
    private readonly woods: ClassifiedPoly[],
    sampleAlt: (lng: number, lat: number) => number,
    readonly world: WorldOrigin,
  ) {
    this.alt = latticeSampler(sampleAlt);
    this.toLocal = enuMapper(world);
  }

  private begin(poly: ClassifiedPoly): WoodCursor | null {
    const outer = poly.rings[0];
    if (!outer || ringAreaM2(outer) < MIN_WOOD_M2) return null;
    const [west, south, east, north] = ringBbox(outer);
    const midLat = (south + north) / 2;
    const mx = 111320 * Math.cos((midLat * Math.PI) / 180);
    const dLng = TREE_SPACING_M / mx;
    const dLat = TREE_SPACING_M / 111320;
    return {
      poly,
      outer,
      east,
      north,
      dLng,
      dLat,
      startLng: Math.floor(west / dLng) * dLng,
      lat: Math.floor(south / dLat) * dLat,
    };
  }

  private scanRow(cur: WoodCursor): void {
    const { poly, outer, dLng, dLat, lat } = cur;
    const rings = poly.rings;
    const iy = Math.round(lat / dLat);
    for (let lng = cur.startLng; lng <= cur.east && this.placed < TREE_CAP_PER_TILE; lng += dLng) {
      const ix = Math.round(lng / dLng);
      const cell = ix * 4194304 + iy;
      if (this.occupied.has(cell)) continue;
      if (hash2(ix, iy, 4) > TREE_KEEP) continue;
      const x = lng + dLng * 0.5 + (hash2(ix, iy, 5) - 0.5) * dLng * 1.2;
      const y = lat + dLat * 0.5 + (hash2(ix, iy, 8) - 0.5) * dLat * 1.2;
      if (!pointInRing(x, y, outer)) continue;
      let inHole = false;
      for (let h = 1; h < rings.length; h++) {
        const hole = rings[h];
        if (hole && pointInRing(x, y, hole)) {
          inHole = true;
          break;
        }
      }
      if (inHole) continue;
      const alt = this.alt(x, y);
      if (!Number.isFinite(alt)) continue;
      this.occupied.add(cell);
      const bucket = treeBucketFast(poly.leaf, ix, iy);
      const scale = treeScaleFast(ix, iy, bucket);
      const yaw = hash2(ix, iy, 7) * Math.PI * 2;
      this.toLocal(x, y, alt, this.p);
      const cy = Math.cos(yaw) * scale;
      const sy = Math.sin(yaw) * scale;
      let list = this.buckets.get(bucket);
      if (!list) {
        list = [];
        this.buckets.set(bucket, list);
      }
      // T * Rx(90deg) * Ry(yaw) * S(scale), column-major. Same matrix yUpEnuMatrix builds, without five allocations.
      list.push(cy, sy, 0, 0, 0, 0, scale, 0, sy, -cy, 0, 0, this.p[0], this.p[1], this.p[2], 1);
      this.placed += 1;
    }
  }

  /** Returns true once every polygon has been scanned (or the per-tile cap is reached). */
  run(budgetMs: number): boolean {
    const deadline = performance.now() + budgetMs;
    while (this.placed < TREE_CAP_PER_TILE) {
      if (!this.cursor) {
        const poly = this.woods[this.next++];
        if (!poly) return true;
        this.cursor = this.begin(poly);
        if (!this.cursor) continue;
      }
      const cur = this.cursor;
      this.scanRow(cur);
      cur.lat += cur.dLat;
      if (cur.lat > cur.north) this.cursor = null;
      if (performance.now() > deadline) return !this.cursor && this.next >= this.woods.length;
    }
    return true;
  }

  build(): THREE.Group | null {
    if (!this.placed) return null;
    const group = new THREE.Group();
    for (const [bucket, flat] of this.buckets) {
      const count = flat.length / 16;
      const mesh = new THREE.InstancedMesh(TREE_GEOMS[bucket], SHARED_TREE_MAT, count);
      (mesh.instanceMatrix.array as Float32Array).set(flat);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.userData.sharedGeom = true;
      markSceneObject(mesh);
      group.add(mesh);
    }
    return group;
  }
}

export function paintLeafFromStands(
  woods: ClassifiedPoly[],
  stands: Array<{ rings: LngLatRing[]; leaf: WoodLeaf }>,
): void {
  if (!stands.length) return;
  for (const wood of woods) {
    if (wood.leaf && wood.leaf !== 'forest') continue;
    const outer = wood.rings[0];
    if (!outer?.length) continue;
    let lng = 0;
    let lat = 0;
    for (const p of outer) {
      lng += p[0];
      lat += p[1];
    }
    lng /= outer.length;
    lat /= outer.length;
    for (const stand of stands) {
      const ring = stand.rings[0];
      if (ring && pointInRing(lng, lat, ring)) {
        wood.leaf = stand.leaf;
        break;
      }
    }
  }
}

/**
 * Build steps run one per timer tick so a tile never blocks a frame for its whole build.
 * Roads and trains are no longer per tile: OsmTileStream builds one rail graph for all loaded tiles.
 */
export type TileBuildStep = 'trees';
export const TILE_BUILD_STEPS: readonly TileBuildStep[] = ['trees'];

export function createOsmTileGroup(tile: TileId): THREE.Group {
  const group = new THREE.Group();
  group.name = tileKey(tile);
  markSceneObject(group);
  return group;
}

export function addOsmTileStep(
  group: THREE.Group,
  step: TileBuildStep,
  data: ParsedOsmTile,
  zoom: number,
  sampleAlt: (lng: number, lat: number) => number,
  world: WorldOrigin,
): void {
  if (zoom < 14 || step !== 'trees') return;
  const job = new WoodScatterJob(data.woods, sampleAlt, world);
  job.run(Number.POSITIVE_INFINITY);
  const trees = job.build();
  if (trees) group.add(trees);
}

export function buildOsmTileGroup(
  tile: TileId,
  data: ParsedOsmTile,
  zoom: number,
  sampleAlt: (lng: number, lat: number) => number,
  world: WorldOrigin,
): THREE.Group {
  const group = createOsmTileGroup(tile);
  for (const step of TILE_BUILD_STEPS) addOsmTileStep(group, step, data, zoom, sampleAlt, world);
  return group;
}

export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) && !(obj instanceof THREE.InstancedMesh)) return;
    if (!SHARED_GEOMS.has(obj.geometry) && !obj.userData.sharedGeom) obj.geometry.dispose();
    const mat = obj.material;
    const drop = (item: THREE.Material) => {
      if (!SHARED_MATS.has(item) && !obj.userData.sharedGeom) item.dispose();
    };
    if (Array.isArray(mat)) mat.forEach(drop);
    else drop(mat);
  });
}

export function disposeGroup(group: THREE.Group): void {
  disposeObject3D(group);
}

type GroundPoint = { lng: number; lat: number; alt: number };

function pointsAlong(
  line: [number, number][],
  spacing: number,
  sampleAlt: (lng: number, lat: number) => number,
): GroundPoint[] {
  const out: GroundPoint[] = [];
  let cursor = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const [lng0, lat0] = line[i]!;
    const [lng1, lat1] = line[i + 1]!;
    const mx = 111320 * Math.cos((lat0 * Math.PI) / 180);
    const len = Math.hypot((lng1 - lng0) * mx, (lat1 - lat0) * 111320);
    if (len < 0.05) continue;
    while (cursor <= len + 1e-4 && out.length < 1600) {
      const t = Math.min(1, cursor / len);
      const lng = lng0 + (lng1 - lng0) * t;
      const lat = lat0 + (lat1 - lat0) * t;
      const alt = sampleAlt(lng, lat);
      if (Number.isFinite(alt)) out.push({ lng, lat, alt });
      cursor += spacing;
    }
    cursor -= len;
  }
  return out;
}

function railMatrix(world: WorldOrigin, a: GroundPoint, b: GroundPoint, lift: number): THREE.Matrix4 | null {
  const p0 = enu(world, a.lng, a.lat, a.alt + lift);
  const p1 = enu(world, b.lng, b.lat, b.alt + lift);
  const delta = p1.clone().sub(p0);
  const len = delta.length();
  if (len < 0.2) return null;
  const xAxis = delta.multiplyScalar(1 / len);
  const up = new THREE.Vector3(0, 0, 1);
  const side = new THREE.Vector3().crossVectors(xAxis, up);
  if (side.lengthSq() < 1e-8) side.set(0, 1, 0);
  side.normalize();
  const yAxis = new THREE.Vector3().crossVectors(side, xAxis).normalize();
  const m = new THREE.Matrix4().makeBasis(xAxis.clone().multiplyScalar(len), yAxis, side);
  m.setPosition(p0.add(p1).multiplyScalar(0.5));
  return m;
}

export function hedgeAlong(
  line: [number, number][],
  sampleAlt: (lng: number, lat: number) => number,
  world: WorldOrigin,
): THREE.Object3D | null {
  const pts = pointsAlong(line, 1.7, sampleAlt);
  const mats: THREE.Matrix4[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const scale = 0.9 + hash01(`hedge:${p.lng.toFixed(5)}:${p.lat.toFixed(5)}`) * 0.35;
    const yaw = hash01(`hedge-r:${i}:${p.lng.toFixed(4)}`) * Math.PI * 2;
    mats.push(yUpEnuMatrix(world, p.lng, p.lat, p.alt, scale, yaw));
  }
  return instanced(SHARED_BUSH_GEOM, SHARED_TREE_MAT, mats);
}

export function fenceAlong(
  line: [number, number][],
  sampleAlt: (lng: number, lat: number) => number,
  world: WorldOrigin,
): THREE.Group {
  const group = new THREE.Group();
  const pts = pointsAlong(line, 2.5, sampleAlt);
  if (pts.length) {
    const posts = pts.map((p) => yUpEnuMatrix(world, p.lng, p.lat, p.alt, 1, 0));
    const postMesh = new THREE.InstancedMesh(FENCE_POST_GEOM, FENCE_MAT, posts.length);
    for (let i = 0; i < posts.length; i++) postMesh.setMatrixAt(i, posts[i]!);
    postMesh.instanceMatrix.needsUpdate = true;
    postMesh.userData.sharedGeom = true;
    markSceneObject(postMesh);
    group.add(postMesh);
  }
  const rails: THREE.Matrix4[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (const lift of [0.42, 0.95]) {
      const m = railMatrix(world, pts[i]!, pts[i + 1]!, lift);
      if (m) rails.push(m);
    }
  }
  if (rails.length) {
    const railMesh = new THREE.InstancedMesh(FENCE_RAIL_GEOM, FENCE_MAT, rails.length);
    for (let i = 0; i < rails.length; i++) railMesh.setMatrixAt(i, rails[i]!);
    railMesh.instanceMatrix.needsUpdate = true;
    railMesh.userData.sharedGeom = true;
    markSceneObject(railMesh);
    group.add(railMesh);
  }
  markSceneObject(group);
  return group;
}

function bucketFromLeaf(leaf: WoodLeaf, seed: string): TreeBucket {
  const n = Math.floor(hash01(`${seed}:n`) * 90);
  return treeBucket(leaf, seed, n, n + 3);
}

export function loneTree(
  lng: number,
  lat: number,
  alt: number,
  seed: string,
  world: WorldOrigin,
  leaf: WoodLeaf = 'forest',
  heightM?: number,
): THREE.Mesh {
  const bucket = bucketFromLeaf(leaf, seed);
  const mesh = new THREE.Mesh(TREE_GEOMS[bucket], SHARED_TREE_MAT);
  const base = bucket.startsWith('needle') ? 18 : bucket.startsWith('broad') ? 14 : 3.2;
  const tagged = heightM != null && heightM > 2 ? heightM / base : 0;
  const scale = tagged > 0 ? Math.min(2.2, Math.max(0.45, tagged)) : treeScale(seed, bucket);
  mesh.applyMatrix4(yUpEnuMatrix(world, lng, lat, alt, scale, hash01(`${seed}:r`) * Math.PI * 2));
  mesh.userData.sharedGeom = true;
  markSceneObject(mesh);
  return mesh;
}
