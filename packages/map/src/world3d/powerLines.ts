import * as THREE from 'three';
import { enu, type WorldOrigin } from './lngLat.js';

export type PowerNode = {
  lng: number;
  lat: number;
  kind: 'tower' | 'pole';
  material?: string;
  design?: string;
  attachment?: string;
  height?: number;
};

export type PowerLine = {
  kind: 'line' | 'minor';
  cables?: number;
  voltage?: number;
  line: [number, number][];
};

const STEEL = new THREE.MeshBasicMaterial({ color: 0xa7b0b8 });
const WOOD = new THREE.MeshBasicMaterial({ color: 0x7a5434 });
const CONCRETE = new THREE.MeshBasicMaterial({ color: 0xb8b2a8 });
const CABLE = new THREE.MeshBasicMaterial({ color: 0x24282d });

const CABLE_GEOM = new THREE.BoxGeometry(1, 0.09, 0.09);

function strut(a: [number, number, number], b: [number, number, number], thick: number): THREE.BufferGeometry {
  const geom = new THREE.BoxGeometry(1, thick, thick);
  const from = new THREE.Vector3(a[0], a[1], a[2]);
  const to = new THREE.Vector3(b[0], b[1], b[2]);
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const dir = to.sub(from);
  const len = Math.max(0.08, dir.length());
  dir.multiplyScalar(1 / len);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
  geom.applyMatrix4(new THREE.Matrix4().compose(mid, quat, new THREE.Vector3(len, 1, 1)));
  return geom;
}

function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const chunks: Float32Array[] = [];
  let total = 0;
  for (const part of parts) {
    const flat = part.index ? part.toNonIndexed() : part;
    const arr = flat.getAttribute('position').array as Float32Array;
    chunks.push(new Float32Array(arr));
    total += arr.length;
    if (flat !== part) flat.dispose();
    part.dispose();
  }
  const pos = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    pos.set(chunk, offset);
    offset += chunk.length;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return geom;
}

function towerGeometry(branch: boolean): THREE.BufferGeometry {
  const height = 36;
  const parts: THREE.BufferGeometry[] = [];
  const base = branch ? 2.8 : 2.3;
  const top = branch ? 1.05 : 0.72;
  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (const [sx, sz] of corners) {
    parts.push(strut([sx * base, 0, sz * base], [sx * top, height, sz * top], 0.22));
  }
  for (const y of [8, 16, 24, 31]) {
    const w = base + (top - base) * (y / height);
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i]!;
      const b = corners[(i + 1) % corners.length]!;
      parts.push(strut([a[0] * w, y, a[1] * w], [b[0] * w, y, b[1] * w], 0.1));
    }
  }
  const arms = branch ? [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3] : [0];
  const reach = branch ? 7.2 : 7.4;
  for (const ang of arms) {
    const cx = Math.cos(ang);
    const cz = Math.sin(ang);
    for (const y of [height * 0.78, height * 0.9]) {
      parts.push(strut([-cx * reach, y, -cz * reach], [cx * reach, y, cz * reach], branch ? 0.18 : 0.24));
    }
  }
  parts.push(strut([0, height * 0.9, 0], [0, height + 2.4, 0], 0.14));
  return mergeParts(parts);
}

function poleGeometry(): THREE.BufferGeometry {
  const pole = new THREE.CylinderGeometry(0.16, 0.28, 11, 6);
  pole.translate(0, 5.5, 0);
  const arm = new THREE.BoxGeometry(4.6, 0.2, 0.18);
  arm.translate(0, 9.9, 0);
  return mergeParts([pole, arm]);
}

const TOWER_GEOM = towerGeometry(false);
const BRANCH_GEOM = towerGeometry(true);
const POLE_GEOM = poleGeometry();

export const powerSharedGeometries = [TOWER_GEOM, BRANCH_GEOM, POLE_GEOM, CABLE_GEOM];
export const powerSharedMaterials = [STEEL, WOOD, CONCRETE, CABLE];

type Mast = {
  lng: number;
  lat: number;
  kind: 'tower' | 'pole';
  wood: boolean;
  branch: boolean;
  /** Set when OSM already gave a height. Voltage must not replace it. */
  fixedHeight: boolean;
  height: number;
  heading: number;
  links: number;
  voltage: number;
};

function mastKey(lng: number, lat: number): string {
  return `${lng.toFixed(5)},${lat.toFixed(5)}`;
}

function segmentMeters(a: [number, number], b: [number, number]): number {
  const mx = 111320 * Math.cos((a[1] * Math.PI) / 180);
  return Math.hypot((b[0] - a[0]) * mx, (b[1] - a[1]) * 111320);
}

function segmentHeading(a: [number, number], b: [number, number]): number {
  const mx = 111320 * Math.cos((a[1] * Math.PI) / 180);
  return Math.atan2((b[1] - a[1]) * 111320, (b[0] - a[0]) * mx);
}

function towerHeight(voltage: number, tagged?: number): number {
  if (tagged && tagged > 8) return Math.min(72, Math.max(16, tagged));
  if (voltage >= 220000) return 46;
  if (voltage >= 110000) return 36;
  return 28;
}

function poleHeight(tagged?: number): number {
  if (tagged && tagged > 4) return Math.min(18, Math.max(7, tagged));
  return 11;
}

function mastMatrix(world: WorldOrigin, mast: Mast, ground: number): THREE.Matrix4 {
  const nominal = mast.kind === 'tower' ? 36 : 11;
  const p = enu(world, mast.lng, mast.lat, ground);
  const t = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z);
  const rx = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  const ry = new THREE.Matrix4().makeRotationY(mast.heading + Math.PI / 2);
  const sc = new THREE.Matrix4().makeScale(1, mast.height / nominal, 1);
  return t.multiply(rx).multiply(ry).multiply(sc);
}

function segMatrix(p0: THREE.Vector3, p1: THREE.Vector3, thick: number): THREE.Matrix4 | null {
  const delta = p1.clone().sub(p0);
  const len = delta.length();
  if (len < 0.4) return null;
  const xAxis = delta.multiplyScalar(1 / len);
  const up = new THREE.Vector3(0, 0, 1);
  const side = new THREE.Vector3().crossVectors(xAxis, up);
  if (side.lengthSq() < 1e-8) side.set(0, 1, 0);
  side.normalize();
  const yAxis = new THREE.Vector3().crossVectors(side, xAxis).normalize();
  const m = new THREE.Matrix4().makeBasis(
    xAxis.clone().multiplyScalar(len),
    yAxis.multiplyScalar(thick),
    side.multiplyScalar(thick),
  );
  m.setPosition(p0.clone().add(p1).multiplyScalar(0.5));
  return m;
}

function finishSphere(mesh: THREE.InstancedMesh): void {
  mesh.userData.sharedGeom = true;
  mesh.frustumCulled = true;
  const arr = mesh.instanceMatrix.array as Float32Array;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < mesh.count; i++) {
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
  mesh.boundingSphere = new THREE.Sphere(
    new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2),
    0.5 * Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) + 48,
  );
}

function addInstances(group: THREE.Group, geom: THREE.BufferGeometry, mat: THREE.Material, matrices: THREE.Matrix4[]): void {
  if (!matrices.length) return;
  const mesh = new THREE.InstancedMesh(geom, mat, matrices.length);
  for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i]!);
  mesh.instanceMatrix.needsUpdate = true;
  finishSphere(mesh);
  group.add(mesh);
}

type Wire = { level: number; offset: number; sag: number; thick: number };

function wiresFor(kind: 'line' | 'minor', cables?: number): Wire[] {
  const high = kind === 'line';
  const count = cables && cables > 0 ? Math.min(8, Math.round(cables)) : 3;
  const width = high ? 6.8 : 2.05;
  const sag = high ? 0.016 : 0.045;
  const thick = high ? 2.1 : 1.35;
  const levels = high && count > 3 ? [0.9, 0.78] : [high ? 0.9 : 0.9];
  const per = Math.ceil(count / levels.length);
  const wires: Wire[] = [];
  for (const level of levels) {
    for (let i = 0; i < per && wires.length < count; i++) {
      const u = per === 1 ? 0 : (i / (per - 1)) * 2 - 1;
      wires.push({ level, offset: u * width, sag, thick });
    }
  }
  if (high) wires.push({ level: 1.05, offset: 0, sag: sag * 0.45, thick: 0.8 });
  return wires;
}

/**
 * Lattice towers, wooden poles and the cables between them.
 * A tower with three outgoing lines, or an OSM branch tag, becomes a three-way mast.
 */
export function buildPowerGroup(
  nodes: PowerNode[],
  lines: PowerLine[],
  sampleAlt: (lng: number, lat: number) => number,
  world: WorldOrigin,
): THREE.Group | null {
  if (!nodes.length && !lines.length) return null;
  const masts = new Map<string, Mast>();
  for (const node of nodes) {
    const wood = node.kind === 'pole' && node.material !== 'concrete' && node.material !== 'steel';
    const taggedBranch = node.attachment === 'branch' || (node.design ?? '').includes('branch');
    masts.set(mastKey(node.lng, node.lat), {
      lng: node.lng,
      lat: node.lat,
      kind: node.kind,
      wood,
      branch: taggedBranch,
      fixedHeight: node.height != null,
      height: node.kind === 'tower' ? towerHeight(0, node.height) : poleHeight(node.height),
      heading: 0,
      links: 0,
      voltage: 0,
    });
  }

  const remember = (lng: number, lat: number, heading: number, voltage: number) => {
    const mast = masts.get(mastKey(lng, lat));
    if (!mast) return;
    if (mast.links === 0) mast.heading = heading;
    mast.links += 1;
    if (mast.links >= 3) mast.branch = true;
    if (voltage > mast.voltage) mast.voltage = voltage;
  };

  const towers: THREE.Matrix4[] = [];
  const branches: THREE.Matrix4[] = [];
  const woodPoles: THREE.Matrix4[] = [];
  const grayPoles: THREE.Matrix4[] = [];
  const cables: THREE.Matrix4[] = [];

  const hang = (line: PowerLine) => {
    const pts = line.line;
    if (pts.length < 2) return;
    const supports: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      if (masts.has(mastKey(pts[i]![0], pts[i]![1])) || i === 0 || i === pts.length - 1) supports.push(i);
    }
    for (let s = 0; s < supports.length - 1; s++) {
      const a = supports[s]!;
      const b = supports[s + 1]!;
      const from = pts[a]!;
      const to = pts[b]!;
      const span = segmentMeters(from, to);
      if (span < 3) continue;
      const head = segmentHeading(from, to);
      remember(from[0], from[1], head, line.voltage ?? 0);
      remember(to[0], to[1], head + Math.PI, line.voltage ?? 0);
    }
  };
  for (const line of lines) hang(line);

  const altOf = (lng: number, lat: number) => {
    const alt = sampleAlt(lng, lat);
    return Number.isFinite(alt) ? alt : Number.NaN;
  };

  for (const mast of masts.values()) {
    if (mast.kind === 'tower' && !mast.fixedHeight) mast.height = towerHeight(mast.voltage, undefined);
    const ground = altOf(mast.lng, mast.lat);
    if (!Number.isFinite(ground)) continue;
    const matrix = mastMatrix(world, mast, ground);
    if (mast.kind === 'tower') {
      if (mast.branch) {
        if (branches.length < 80) branches.push(matrix);
      } else if (towers.length < 160) towers.push(matrix);
    } else if (mast.wood) {
      if (woodPoles.length < 700) woodPoles.push(matrix);
    } else if (grayPoles.length < 400) grayPoles.push(matrix);
  }

  const hangCables = (line: PowerLine) => {
    const pts = line.line;
    const supports: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      if (masts.has(mastKey(pts[i]![0], pts[i]![1])) || i === 0 || i === pts.length - 1) supports.push(i);
    }
    const wires = wiresFor(line.kind, line.cables);
    for (let s = 0; s < supports.length - 1 && cables.length < 5000; s++) {
      const from = pts[supports[s]!]!;
      const to = pts[supports[s + 1]!]!;
      const span = segmentMeters(from, to);
      if (span < 3) continue;
      const startMast = masts.get(mastKey(from[0], from[1]));
      const endMast = masts.get(mastKey(to[0], to[1]));
      const g0 = altOf(from[0], from[1]);
      const g1 = altOf(to[0], to[1]);
      if (!Number.isFinite(g0) || !Number.isFinite(g1)) continue;
      const h0 = startMast?.height ?? (line.kind === 'line' ? 32 : 11);
      const h1 = endMast?.height ?? h0;
      const mx = 111320 * Math.cos((from[1] * Math.PI) / 180);
      const east = ((to[0] - from[0]) * mx) / (span || 1);
      const north = ((to[1] - from[1]) * 111320) / (span || 1);
      const rightEast = north;
      const rightNorth = -east;
      const chain = pts.slice(supports[s]!, supports[s + 1]! + 1);
      let travelled = 0;
      const length = chain.reduce((sum, _p, i) => (i === 0 ? 0 : sum + segmentMeters(chain[i - 1]!, chain[i]!)), 0);
      if (length < 3) continue;
      const step = line.kind === 'line' ? 18 : 12;
      const samples: { lng: number; lat: number; t: number }[] = [];
      samples.push({ lng: chain[0]![0], lat: chain[0]![1], t: 0 });
      let cursor = step;
      for (let i = 1; i < chain.length; i++) {
        const seg = segmentMeters(chain[i - 1]!, chain[i]!);
        if (seg < 0.2) continue;
        while (cursor <= travelled + seg && samples.length < 80) {
          const u = (cursor - travelled) / seg;
          const lng = chain[i - 1]![0] + (chain[i]![0] - chain[i - 1]![0]) * u;
          const lat = chain[i - 1]![1] + (chain[i]![1] - chain[i - 1]![1]) * u;
          samples.push({ lng, lat, t: Math.min(1, cursor / length) });
          cursor += step;
        }
        travelled += seg;
      }
      const last = chain[chain.length - 1]!;
      samples.push({ lng: last[0], lat: last[1], t: 1 });
      for (const wire of wires) {
        if (cables.length >= 5000) break;
        const z0 = g0 + h0 * wire.level;
        const z1 = g1 + h1 * wire.level;
        const sag = Math.min(Math.min(h0, h1) * 0.45, Math.max(0.35, length * wire.sag));
        let prev: THREE.Vector3 | null = null;
        for (const sample of samples) {
          const ground = altOf(sample.lng, sample.lat);
          const chord = z0 + (z1 - z0) * sample.t - Math.sin(Math.PI * sample.t) * sag;
          const z = Number.isFinite(ground) ? Math.max(chord, ground + 4) : chord;
          const lng = sample.lng + (rightEast * wire.offset) / mx;
          const lat = sample.lat + (rightNorth * wire.offset) / 111320;
          const point = enu(world, lng, lat, z);
          if (prev) {
            const matrix = segMatrix(prev, point, wire.thick);
            if (matrix) cables.push(matrix);
          }
          prev = point;
        }
      }
    }
  };
  for (const line of lines) hangCables(line);

  if (!towers.length && !branches.length && !woodPoles.length && !grayPoles.length && !cables.length) return null;
  const group = new THREE.Group();
  group.name = 'power';
  addInstances(group, TOWER_GEOM, STEEL, towers);
  addInstances(group, BRANCH_GEOM, STEEL, branches);
  addInstances(group, POLE_GEOM, WOOD, woodPoles);
  addInstances(group, POLE_GEOM, CONCRETE, grayPoles);
  addInstances(group, CABLE_GEOM, CABLE, cables);
  return group;
}
