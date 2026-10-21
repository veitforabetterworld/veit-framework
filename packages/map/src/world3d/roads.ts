import * as THREE from 'three';
import { hash01 } from './hash.js';
import { enu, type WorldOrigin } from './lngLat.js';
import type { LineFeature, LngLatRing } from './mvt.js';

type RGB = [number, number, number];

const ROAD_LIFT = 1.15;

const ACTOR_MAT = new THREE.MeshBasicMaterial({ vertexColors: true });

function mergeColored(parts: Array<{ geom: THREE.BufferGeometry; color: RGB }>): THREE.BufferGeometry {
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
  return merged;
}

function locoGeometry(): THREE.BufferGeometry {
  const body = new THREE.BoxGeometry(15.5, 3.4, 2.85);
  body.translate(-0.6, 2.05, 0);
  const cab = new THREE.BoxGeometry(4.4, 1.35, 2.65);
  cab.translate(3.6, 4.15, 0);
  const nose = new THREE.BoxGeometry(2.4, 1.5, 2.45);
  nose.translate(6.8, 1.55, 0);
  const stripe = new THREE.BoxGeometry(14.6, 0.32, 2.92);
  stripe.translate(-0.4, 3.35, 0);
  return mergeColored([
    { geom: body, color: [0.7, 0.12, 0.11] },
    { geom: cab, color: [0.48, 0.08, 0.08] },
    { geom: nose, color: [0.9, 0.9, 0.92] },
    { geom: stripe, color: [0.93, 0.91, 0.88] },
  ]);
}

function wagonGeometry(body: RGB): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(13.2, 3.15, 2.8);
  box.translate(0, 1.95, 0);
  const roof = new THREE.BoxGeometry(12.8, 0.28, 2.6);
  roof.translate(0, 3.6, 0);
  const windows = new THREE.BoxGeometry(11.6, 0.7, 2.88);
  windows.translate(0, 2.65, 0);
  return mergeColored([
    { geom: box, color: body },
    { geom: roof, color: [0.72, 0.74, 0.76] },
    { geom: windows, color: [0.58, 0.74, 0.84] },
  ]);
}

const LOCO = locoGeometry();
const WAGON_RED = wagonGeometry([0.78, 0.8, 0.82]);
const WAGON_BLUE = wagonGeometry([0.16, 0.32, 0.55]);

const ACTOR_GEOMS: Record<string, THREE.BufferGeometry> = {
  loco: LOCO,
  wagonRed: WAGON_RED,
  wagonBlue: WAGON_BLUE,
};

export const roadSharedMaterials: THREE.Material[] = [ACTOR_MAT];
export const roadSharedGeometries: THREE.BufferGeometry[] = [...Object.values(ACTOR_GEOMS)];

type Ribbon = 'asphalt' | 'gravel' | 'dirt' | 'concrete' | 'cycle' | 'rail';

type RoadKind = {
  ribbon: Ribbon;
  width: number;
  shoulder: number;
  bridge: boolean;
  stack: number;
  oneway: -1 | 0 | 1;
  cars: boolean;
  trucks: boolean;
  bikes: boolean;
  people: boolean;
  parked: boolean;
  sidewalk: boolean;
  trains: boolean;
  tractor: boolean;
  /** May be ridden onto from a cycleway, even when bikes are not spawned here. */
  bikeTravel: boolean;
  footTravel: boolean;
  /** Lanes in the direction of travel. OpenMapTiles has no lane count, so this is inferred. */
  lanes: number;
  /** Autobahn and Schnellstraße. Their vehicles do not share the town-street budget. */
  fast: boolean;
  ramp: boolean;
  speed: number;
  gap: number;
};

function tagNo(value?: string): boolean {
  return value === 'no';
}

function tagYes(value?: string): boolean {
  return value === 'yes' || value === 'designated';
}

function decorate(road: LineFeature, kind: RoadKind): RoadKind | null {
  if (tagNo(road.foot)) {
    kind.people = false;
    kind.sidewalk = false;
  }
  if (tagNo(road.bicycle)) kind.bikes = false;
  if (road.access === 'no' || road.access === 'private') {
    kind.cars = false;
    kind.trucks = false;
    kind.parked = false;
  }
  const street = kind.cars || kind.trucks || kind.sidewalk;
  const fast = road.klass === 'motorway' || road.klass === 'trunk';
  kind.bikeTravel = kind.bikes || (street && !fast && !tagNo(road.bicycle));
  kind.footTravel = kind.people || kind.sidewalk;
  const alive =
    kind.cars ||
    kind.trucks ||
    kind.bikes ||
    kind.people ||
    kind.sidewalk ||
    kind.parked ||
    kind.trains ||
    kind.tractor ||
    kind.bikeTravel ||
    kind.footTravel;
  return alive ? kind : null;
}

function kindOf(road: LineFeature): RoadKind | null {
  const klass = road.klass;
  const sub = road.subclass ?? '';
  const surface = (road.surface ?? '').toLowerCase();
  const service = road.service ?? '';
  if (road.brunnel === 'tunnel') return null;
  if (klass === 'pier' || klass === 'ferry' || klass === 'bridge') return null;
  const bridge = road.brunnel === 'bridge';
  const oneway = road.oneway ?? 0;
  const stack = road.stack ?? 0;
  const paved = surface === 'paved' || surface === 'asphalt' || surface === 'concrete';
  const unpaved = /unpaved|gravel|dirt|ground|earth|grass|mud|sand/.test(surface);
  const base = {
    bridge,
    stack,
    oneway,
    cars: false,
    trucks: false,
    bikes: false,
    people: false,
    parked: false,
    sidewalk: false,
    trains: false,
    tractor: false,
    bikeTravel: false,
    footTravel: false,
    lanes: 1,
    fast: false,
    ramp: false,
    shoulder: 0,
    speed: 0,
    gap: 0,
  };

  if (klass === 'rail' || sub === 'rail') {
    const yard = service === 'siding' || service === 'yard' || service === 'spur';
    return decorate(road, {
      ...base,
      ribbon: 'rail',
      width: 3.4,
      trains: true,
      speed: yard ? 0 : 20,
      gap: yard ? 160 : 420,
      oneway,
    });
  }
  if (sub === 'steps') {
    return decorate(road, { ...base, ribbon: 'concrete', width: 1.15, people: true, speed: 0.7, gap: 18 });
  }
  if (klass === 'motorway') {
    const link = road.ramp === true;
    return decorate(road, {
      ...base,
      ribbon: 'asphalt',
      width: link ? 4.2 : 11,
      cars: true,
      trucks: true,
      speed: link ? 16 : 26,
      gap: link ? 150 : 70,
      lanes: link ? 1 : 3,
      fast: true,
      ramp: link,
      oneway: oneway || 1,
    });
  }
  if (klass === 'trunk') {
    const link = road.ramp === true;
    const divided = !link && oneway !== 0;
    return decorate(road, {
      ...base,
      ribbon: 'asphalt',
      width: link ? 4.2 : 7.4,
      cars: true,
      trucks: true,
      speed: link ? 14 : 20,
      gap: link ? 140 : 64,
      lanes: divided ? 2 : 1,
      fast: true,
      ramp: link,
    });
  }
  if (klass === 'primary') {
    const divided = oneway !== 0 && road.ramp !== true;
    return decorate(road, {
      ...base,
      ribbon: 'asphalt',
      width: 6.2,
      shoulder: 0.85,
      sidewalk: true,
      cars: true,
      speed: 14,
      gap: 58,
      lanes: divided ? 2 : 1,
    });
  }
  if (klass === 'secondary') {
    return decorate(road, { ...base, ribbon: 'asphalt', width: 5.6, shoulder: 0.9, sidewalk: true, cars: true, speed: 12, gap: 50 });
  }
  if (klass === 'tertiary') {
    return decorate(road, { ...base, ribbon: 'asphalt', width: 5.1, shoulder: 0.85, sidewalk: true, cars: true, speed: 11, gap: 46 });
  }
  if (klass === 'minor') {
    return decorate(road, {
      ...base,
      ribbon: unpaved ? 'gravel' : 'asphalt',
      width: 5.2,
      shoulder: unpaved ? 0 : 0.8,
      sidewalk: !unpaved,
      cars: true,
      parked: !unpaved,
      speed: 8,
      gap: 40,
    });
  }
  if (klass === 'service') {
    const driveway = service === 'driveway' || service === 'alley';
    return decorate(road, {
      ...base,
      ribbon: unpaved ? 'gravel' : 'asphalt',
      width: driveway ? 2.3 : 3.1,
      parked: driveway || service === 'parking_aisle',
      cars: !driveway && service !== 'parking_aisle',
      speed: 6,
      gap: 64,
    });
  }
  if (klass === 'track') {
    return decorate(road, {
      ...base,
      ribbon: paved ? 'asphalt' : 'gravel',
      width: 3.3,
      people: !tagNo(road.foot),
      bikes: !tagNo(road.bicycle),
      tractor: true,
      speed: 3.4,
      gap: 80,
    });
  }
  if (klass === 'path') {
    if (sub === 'cycleway') {
      return decorate(road, {
        ...base,
        ribbon: unpaved ? 'dirt' : 'cycle',
        width: 1.8,
        bikes: true,
        people: !tagNo(road.foot),
        speed: 5.2,
        gap: 34,
      });
    }
    if (sub === 'pedestrian') {
      return decorate(road, {
        ...base,
        ribbon: unpaved ? 'dirt' : 'concrete',
        width: 3.2,
        people: true,
        bikes: tagYes(road.bicycle),
        speed: 1.3,
        gap: 11,
      });
    }
    if (sub === 'bridleway') {
      return decorate(road, { ...base, ribbon: 'dirt', width: 1.6, people: true, bikes: !tagNo(road.bicycle), speed: 1.2, gap: 22 });
    }
    if (sub === 'footway') {
      return decorate(road, {
        ...base,
        ribbon: unpaved ? 'dirt' : 'concrete',
        width: 1.55,
        people: true,
        bikes: tagYes(road.bicycle),
        speed: 1.35,
        gap: 15,
      });
    }
    return decorate(road, {
      ...base,
      ribbon: paved ? 'concrete' : 'dirt',
      width: 1.25,
      people: true,
      bikes: tagYes(road.bicycle),
      speed: 1.2,
      gap: 20,
    });
  }
  return null;
}

/** One consist every few kilometres, stable in geography so neighbouring tiles do not each add a train. */
function sparseRail(line: LngLatRing): boolean {
  const mid = line[Math.floor(line.length / 2)] ?? line[0];
  if (!mid) return false;
  const mx = 111320 * Math.cos((mid[1] * Math.PI) / 180);
  const phase = mid[0] * mx * 0.62 + mid[1] * 111320 * 0.78;
  const period = 2800;
  const local = ((phase % period) + period) % period;
  return local < 500;
}

function lineLengthM(line: LngLatRing): number {
  let len = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const mx = 111320 * Math.cos((a[1] * Math.PI) / 180);
    len += Math.hypot((b[0] - a[0]) * mx, (b[1] - a[1]) * 111320);
  }
  return len;
}

function cumulate(pts: THREE.Vector3[]): { cum: number[]; length: number } {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + pts[i]!.distanceTo(pts[i - 1]!));
  return { cum, length: cum[cum.length - 1] ?? 0 };
}

/** Parallel running rails sit about 4 m apart, so a wider join fuses them and the train jumps. */
const JOIN_M = 2.5;

type LineSpan = {
  pts: THREE.Vector3[];
  speed: number;
  lateral: number;
  oneway: -1 | 0 | 1;
  gap: number;
  seed: string;
  spawn: boolean;
  trucks: boolean;
  /** 0 Autobahn/Schnellstraße, 1 their ramps, 2 every other road. */
  rank: number;
};

type GEdge = {
  pts: THREE.Vector3[];
  cum: number[];
  length: number;
  from: number;
  to: number;
  back: number;
  legal: boolean;
  lateral: number;
  speed: number;
  spawn: boolean;
  trucks: boolean;
  seed: string;
  gap: number;
  rank: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

type TravelGraph = { edges: GEdge[]; out: number[][] };

type Route = {
  pts: THREE.Vector3[];
  cum: number[];
  length: number;
  speed: number;
  dist: number;
  scale: number;
  height: number;
  bob: boolean;
  phase: number;
  lateral: number;
  edge: number;
  hops: number;
  prevEdge: number;
  /** Edges already left, oldest first. Wagons walk this back so they stay on the consist. */
  trail: number[];
  backset: number;
  follow?: Route;
  graph?: TravelGraph;
  /** Multiplier on the road's speed limit, stable for this vehicle. */
  cruise?: number;
  /** Minimum gap to the vehicle ahead, in meters, before the speed term. */
  followGap?: number;
};

type Fleet = { mesh: THREE.InstancedMesh; routes: Route[] };

const _pos = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _side = new THREE.Vector3();
const _up = new THREE.Vector3(0, 0, 1);
const _m = new THREE.Matrix4();
const _sc = new THREE.Vector3();

function resolvedPose(route: Route): { pts: THREE.Vector3[]; cum: number[]; length: number; dist: number; lateral: number } {
  const graph = route.follow?.graph ?? route.graph;
  let edgeIndex = route.follow ? route.follow.edge : route.edge;
  let dist = route.follow ? route.follow.dist - route.backset : route.dist;
  let lateral = route.follow ? route.follow.lateral : route.lateral;
  if (route.follow && dist < 0 && graph) {
    const trail = route.follow.trail;
    for (let i = trail.length - 1; i >= 0 && dist < 0; i--) {
      const prev = graph.edges[trail[i]!];
      if (!prev) break;
      dist += prev.length;
      edgeIndex = trail[i]!;
      lateral = prev.lateral;
    }
  }
  const edge = graph?.edges[edgeIndex];
  if (!edge) return { pts: route.pts, cum: route.cum, length: route.length, dist: route.dist, lateral: route.lateral };
  return { pts: edge.pts, cum: edge.cum, length: edge.length, dist, lateral };
}

function poseAt(route: Route, target: THREE.Vector3, forward: THREE.Vector3): void {
  const posed = resolvedPose(route);
  const { pts, cum, length } = posed;
  let dist = posed.dist;
  if (dist < 0) dist = 0;
  if (dist > length) dist = length;
  const last = pts.length - 1;
  let lo = 0;
  let hi = Math.max(0, last - 1);
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cum[mid]! <= dist) lo = mid;
    else hi = mid - 1;
  }
  const i = lo;
  const span = (cum[i + 1] ?? cum[i] ?? 0) - (cum[i] ?? 0);
  const t = span > 0.05 ? (dist - (cum[i] ?? 0)) / span : 0;
  const a = pts[i]!;
  const b = pts[Math.min(last, i + 1)]!;
  target.lerpVectors(a, b, Math.min(1, Math.max(0, t)));
  forward.set(b.x - a.x, b.y - a.y, 0);
  if (forward.lengthSq() < 1e-6) forward.set(1, 0, 0);
  else forward.normalize();
  if (posed.lateral) {
    target.x += forward.y * posed.lateral;
    target.y -= forward.x * posed.lateral;
  }
  target.z += 0.45;
  if (route.bob) target.z += Math.sin(dist * 3.1 + route.phase) * 0.06;
}

function chooseNext(graph: TravelGraph, edgeIndex: number, _salt: number): number {
  const edge = graph.edges[edgeIndex];
  if (!edge) return edgeIndex;
  const end = edge.pts[edge.pts.length - 1];
  const outs = (graph.out[edge.to] ?? []).filter((id) => id !== edge.back && id !== edgeIndex);
  let best = -1;
  let bestDot = -0.2;
  for (const id of outs) {
    const next = graph.edges[id];
    if (!next || !end) continue;
    const start = next.pts[0];
    if (!start) continue;
    if (Math.hypot(start.x - end.x, start.y - end.y) > 8) continue;
    const dot = edge.endX * next.startX + edge.endY * next.startY;
    if (dot > bestDot) {
      bestDot = dot;
      best = id;
    }
  }
  if (best >= 0) return best;
  return edge.back >= 0 ? edge.back : edgeIndex;
}

function paceFor(key: string, salt: string): number {
  const h = hash01(`${salt}:pace`);
  if (key === 'truck' || key === 'tractor' || key === 'loco') return 0.74 + h * 0.18;
  if (key.startsWith('person')) return 0.78 + h * 0.34;
  if (key.startsWith('bike')) return 0.86 + h * 0.26;
  return 0.8 + h * 0.32;
}

function gapFor(key: string): number {
  if (key === 'truck' || key === 'loco') return 16;
  if (key === 'tractor') return 14;
  if (key.startsWith('person')) return 2.4;
  if (key.startsWith('bike')) return 5;
  return 9;
}

function limitOf(route: Route): number {
  const edge = route.graph?.edges[route.edge];
  return Math.max(0, (edge?.speed ?? route.speed) * (route.cruise ?? 1));
}

type Mover = {
  route: Route;
  move: number;
  x: number;
  y: number;
  z: number;
  fx: number;
  fy: number;
  rank: number;
};

function draftSameLane(graph: TravelGraph, routes: Route[], dt: number): Mover[] {
  const buckets = new Map<number, Mover[]>();
  const movers: Mover[] = [];
  for (const route of routes) {
    poseAt(route, _pos, _fwd);
    const edge = graph.edges[route.edge];
    const mover: Mover = {
      route,
      move: limitOf(route) * dt,
      x: _pos.x,
      y: _pos.y,
      z: _pos.z,
      fx: _fwd.x,
      fy: _fwd.y,
      rank: edge?.rank ?? 2,
    };
    movers.push(mover);
    const list = buckets.get(route.edge) ?? [];
    list.push(mover);
    buckets.set(route.edge, list);
  }
  for (const list of buckets.values()) {
    list.sort((a, b) => b.route.dist - a.route.dist);
    let leadDist = Infinity;
    let leadMove = 0;
    for (const mover of list) {
      if (leadDist < Infinity) {
        const gap = (mover.route.followGap ?? 9) + limitOf(mover.route) * 0.4;
        const room = leadDist + leadMove - mover.route.dist - gap;
        mover.move = Math.min(mover.move, Math.max(0, room));
      }
      leadDist = mover.route.dist;
      leadMove = mover.move;
    }
  }
  for (const mover of movers) {
    const edge = graph.edges[mover.route.edge];
    if (!edge) continue;
    const remain = edge.length - mover.route.dist;
    const gap = (mover.route.followGap ?? 9) + limitOf(mover.route) * 0.4;
    if (remain > gap + 4) continue;
    const nextId = chooseNext(graph, mover.route.edge, Math.floor(mover.route.phase * 997) + mover.route.hops);
    const next = graph.edges[nextId];
    if (!next) continue;
    const dot = edge.endX * next.startX + edge.endY * next.startY;
    if (dot < 0.65) continue;
    const ahead = buckets.get(nextId);
    if (!ahead?.length) continue;
    let nearest = ahead[0]!;
    for (const other of ahead) if (other.route.dist < nearest.route.dist) nearest = other;
    const room = remain + nearest.route.dist + nearest.move - gap;
    mover.move = Math.min(mover.move, Math.max(0, room));
  }
  return movers;
}

/** True when the other road user may go first: higher road, or from the right. */
function waitsFor(me: Mover, other: Mover): boolean {
  if (other.rank < me.rank) return true;
  if (me.rank < other.rank) return false;
  const dx = other.x - me.x;
  const dy = other.y - me.y;
  const right = dx * me.fy - dy * me.fx;
  if (right > 0.8) return true;
  if (right < -0.8) return false;
  return me.route.phase > other.route.phase;
}

function yieldAtCrossings(movers: Mover[]): void {
  const cell = 16;
  const grid = new Map<number, Mover[]>();
  const keyOf = (x: number, y: number) => (Math.floor(x / cell) + 8000) * 20000 + Math.floor(y / cell) + 8000;
  for (const mover of movers) {
    const key = keyOf(mover.x, mover.y);
    const list = grid.get(key) ?? [];
    list.push(mover);
    grid.set(key, list);
  }
  for (const mover of movers) {
    const cx = Math.floor(mover.x / cell);
    const cy = Math.floor(mover.y / cell);
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const list = grid.get((cx + ox + 8000) * 20000 + (cy + oy + 8000));
        if (!list) continue;
        for (const other of list) {
          if (other === mover) continue;
          const dx = other.x - mover.x;
          const dy = other.y - mover.y;
          if (Math.abs(other.z - mover.z) > 4.5) continue;
          if (dx * dx + dy * dy > 14 * 14) continue;
          const along = dx * mover.fx + dy * mover.fy;
          if (along < -1.5) continue;
          const dot = mover.fx * other.fx + mover.fy * other.fy;
          const side = Math.abs(dx * mover.fy - dy * mover.fx);
          if (dot > 0.82 && side < 2.2) {
            const gap = (mover.route.followGap ?? 9) + limitOf(mover.route) * 0.4;
            mover.move = Math.min(mover.move, Math.max(0, along - gap));
            continue;
          }
          if (Math.abs(dot) > 0.58) continue;
          if (mover.route.graph && mover.route.graph === other.route.graph) {
            const nextId = chooseNext(
              mover.route.graph,
              mover.route.edge,
              Math.floor(mover.route.phase * 997) + mover.route.hops,
            );
            if (nextId === other.route.edge || mover.route.edge === other.route.edge) continue;
          }
          if (!waitsFor(mover, other)) continue;
          const room = along - 7;
          mover.move = Math.min(mover.move, Math.max(0, room));
        }
      }
    }
  }
}

function advance(route: Route): void {
  if (!route.graph || route.speed <= 0) return;
  let guard = 0;
  while (guard < 6) {
    const edge = route.graph.edges[route.edge];
    if (!edge || route.dist < edge.length) return;
    const overflow = route.dist - edge.length;
    const nextId = chooseNext(route.graph, route.edge, Math.floor(route.phase * 997) + route.hops);
    const next = route.graph.edges[nextId];
    if (!next || nextId === route.edge) {
      route.dist = Math.max(0, edge.length - 0.5);
      return;
    }
    route.trail.push(route.edge);
    if (route.trail.length > 24) route.trail.shift();
    route.prevEdge = route.edge;
    route.edge = nextId;
    route.dist = overflow;
    if (next.speed > 0) route.speed = next.speed;
    route.lateral = next.lateral;
    route.hops += 1;
    guard += 1;
  }
}

function orient(out: THREE.Matrix4, pos: THREE.Vector3, forward: THREE.Vector3, scale: number, height = scale): void {
  _fwd.copy(forward);
  _fwd.z = 0;
  if (_fwd.lengthSq() < 1e-6) _fwd.set(1, 0, 0);
  _fwd.normalize();
  _side.crossVectors(_fwd, _up);
  if (_side.lengthSq() < 1e-8) _side.set(0, 1, 0);
  _side.normalize();
  out.makeBasis(_fwd, _up, _side);
  out.scale(_sc.set(scale, height, scale));
  out.setPosition(pos);
}

function paint(mesh: THREE.InstancedMesh, routes: Route[]): void {
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i]!;
    poseAt(route, _pos, _fwd);
    orient(_m, _pos, _fwd, route.scale, route.height);
    mesh.setMatrixAt(i, _m);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

function traceDeck(
  line: LngLatRing,
  spacing: number,
  bridge: boolean,
  stack: number,
  sampleAlt: (lng: number, lat: number) => number,
  world: WorldOrigin,
): THREE.Vector3[] | null {
  const raw: Array<{ lng: number; lat: number; alt: number; dist: number }> = [];
  let cursor = 0;
  let travelled = 0;
  for (let i = 0; i < line.length - 1 && raw.length < 360; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const mx = 111320 * Math.cos((a[1] * Math.PI) / 180);
    const seg = Math.hypot((b[0] - a[0]) * mx, (b[1] - a[1]) * 111320);
    if (seg < 0.2) continue;
    while (cursor <= seg + 1e-3 && raw.length < 360) {
      const t = Math.min(1, cursor / seg);
      const lng = a[0] + (b[0] - a[0]) * t;
      const lat = a[1] + (b[1] - a[1]) * t;
      const alt = sampleAlt(lng, lat);
      if (Number.isFinite(alt)) raw.push({ lng, lat, alt, dist: travelled + cursor });
      cursor += spacing;
    }
    cursor -= seg;
    travelled += seg;
  }
  const end = line[line.length - 1];
  const prev = raw[raw.length - 1];
  if (end && prev) {
    const mx = 111320 * Math.cos((end[1] * Math.PI) / 180);
    const gap = Math.hypot((end[0] - prev.lng) * mx, (end[1] - prev.lat) * 111320);
    if (gap > 0.35) {
      const alt = sampleAlt(end[0], end[1]);
      if (Number.isFinite(alt)) raw.push({ lng: end[0], lat: end[1], alt, dist: prev.dist + gap });
    }
  }
  if (raw.length < 2) return null;
  const total = raw[raw.length - 1]!.dist - raw[0]!.dist || 1;
  const a0 = raw[0]!.alt;
  const a1 = raw[raw.length - 1]!.alt;
  const pts: THREE.Vector3[] = [];
  for (const p of raw) {
    const t = (p.dist - raw[0]!.dist) / total;
    const chord = a0 + (a1 - a0) * t;
    const arch = bridge ? Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * 3.1 : 0;
    const raised = !bridge && stack > 0 ? stack * 2.6 : 0;
    const deck = Math.max(p.alt, chord) + ROAD_LIFT + arch + raised;
    pts.push(enu(world, p.lng, p.lat, deck));
  }
  return pts;
}

export type RoadRig = { tick: (dt: number) => void };

export function tickRoadRigs(group: THREE.Object3D, dt: number): void {
  const rigs = group.userData.roadRigs as RoadRig[] | undefined;
  if (!rigs) return;
  for (const rig of rigs) rig.tick(dt);
}

function pointAt(pts: THREE.Vector3[], cum: number[], dist: number): THREE.Vector3 {
  const last = pts.length - 1;
  if (last <= 0 || dist <= 0) return pts[0]!.clone();
  const length = cum[last] ?? 0;
  if (dist >= length) return pts[last]!.clone();
  let i = 0;
  while (i < last - 1 && (cum[i + 1] ?? 0) < dist) i += 1;
  const span = (cum[i + 1] ?? 0) - (cum[i] ?? 0);
  const t = span > 0.01 ? (dist - (cum[i] ?? 0)) / span : 0;
  return pts[i]!.clone().lerp(pts[Math.min(last, i + 1)]!, t);
}

function splitByDistance(pts: THREE.Vector3[], cuts: number[]): THREE.Vector3[][] {
  const { cum, length } = cumulate(pts);
  const marks = [0];
  for (const d of [...cuts].sort((a, b) => a - b)) {
    if (d < 8 || d > length - 8) continue;
    if (d - marks[marks.length - 1]! < 8) continue;
    marks.push(d);
  }
  marks.push(length);
  if (marks.length === 2) return [pts];
  const parts: THREE.Vector3[][] = [];
  for (let m = 0; m < marks.length - 1; m++) {
    const a = marks[m]!;
    const b = marks[m + 1]!;
    const part: THREE.Vector3[] = [pointAt(pts, cum, a)];
    for (let i = 0; i < pts.length; i++) {
      const at = cum[i] ?? 0;
      if (at > a + 0.4 && at < b - 0.4) part.push(pts[i]!.clone());
    }
    part.push(pointAt(pts, cum, b));
    if (part.length >= 2 && b - a > 4) parts.push(part);
  }
  return parts.length ? parts : [pts];
}

function nearestAlong(pts: THREE.Vector3[], p: THREE.Vector3, maxDist: number): number | null {
  let best = maxDist;
  let along = -1;
  let travelled = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    const seg = Math.sqrt(len2) || 0.001;
    let t = len2 > 1e-6 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2 : 0;
    t = Math.min(1, Math.max(0, t));
    const x = a.x + abx * t;
    const y = a.y + aby * t;
    const z = a.z + (b.z - a.z) * t;
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < best && Math.abs(z - p.z) < 5) {
      best = d;
      along = travelled + seg * t;
    }
    travelled += seg;
  }
  return along < 0 ? null : along;
}

/** Cut through-roads where another way of the same kind ends on them. */
function splitSpans(spans: LineSpan[]): LineSpan[] {
  const cuts = spans.map(() => [] as number[]);
  for (let i = 0; i < spans.length; i++) {
    const line = spans[i]!.pts;
    const tips = [line[0], line[line.length - 1]];
    for (const tip of tips) {
      if (!tip) continue;
      for (let j = 0; j < spans.length; j++) {
        if (i === j) continue;
        const along = nearestAlong(spans[j]!.pts, tip, JOIN_M);
        if (along != null) cuts[j]!.push(along);
      }
    }
  }
  const out: LineSpan[] = [];
  for (let j = 0; j < spans.length; j++) {
    const span = spans[j]!;
    for (const pts of splitByDistance(span.pts, cuts[j]!)) out.push({ ...span, pts });
  }
  return out;
}

function edgeDir(pts: THREE.Vector3[], atEnd: boolean): [number, number] {
  const n = pts.length;
  if (n < 2) return [1, 0];
  const origin = pts[atEnd ? n - 1 : 0]!;
  let j = atEnd ? n - 2 : 1;
  let dx = 0;
  let dy = 0;
  while (j >= 0 && j < n) {
    const p = pts[j]!;
    dx = atEnd ? origin.x - p.x : p.x - origin.x;
    dy = atEnd ? origin.y - p.y : p.y - origin.y;
    if (dx * dx + dy * dy > 0.25) break;
    j += atEnd ? -1 : 1;
  }
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

function takeNode(nodes: THREE.Vector3[], p: THREE.Vector3): number {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    const dx = n.x - p.x;
    const dy = n.y - p.y;
    if (dx * dx + dy * dy > JOIN_M * JOIN_M) continue;
    if (Math.abs(n.z - p.z) > 5) continue;
    return i;
  }
  nodes.push(p.clone());
  return nodes.length - 1;
}

function buildGraph(spans: LineSpan[]): TravelGraph {
  const nodes: THREE.Vector3[] = [];
  const edges: GEdge[] = [];
  for (const span of splitSpans(spans)) {
    if (span.pts.length < 2) continue;
    const { length } = cumulate(span.pts);
    if (length < 1.5) continue;
    const fwd = span.pts;
    const rev = span.pts.slice().reverse();
    const from = takeNode(nodes, fwd[0]!);
    const to = takeNode(nodes, fwd[fwd.length - 1]!);
    const push = (pts: THREE.Vector3[], a: number, b: number, legal: boolean) => {
      const run = cumulate(pts);
      if (run.length < 1.5) return -1;
      const [sx, sy] = edgeDir(pts, false);
      const [ex, ey] = edgeDir(pts, true);
      edges.push({
        pts,
        cum: run.cum,
        length: run.length,
        from: a,
        to: b,
        back: -1,
        legal,
        lateral: span.lateral,
        speed: span.speed,
        spawn: span.spawn && legal,
        trucks: span.trucks,
        seed: span.seed,
        gap: span.gap,
        rank: span.rank,
        startX: sx,
        startY: sy,
        endX: ex,
        endY: ey,
      });
      return edges.length - 1;
    };
    const fi = push(fwd, from, to, span.oneway !== -1);
    const ri = push(rev, to, from, span.oneway !== 1);
    if (fi >= 0 && ri >= 0) {
      edges[fi]!.back = ri;
      edges[ri]!.back = fi;
    }
  }
  const out = nodes.map(() => [] as number[]);
  edges.forEach((edge, index) => {
    if (edge.legal) out[edge.from]?.push(index);
  });
  return { edges, out };
}

/**
 * One train consist follows the rail centerlines. Road traffic is not simulated.
 */
export function buildRoadGroup(
  roads: LineFeature[],
  sampleAlt: (lng: number, lat: number) => number,
  world: WorldOrigin,
  buckets?: string[],
): THREE.Group | null {
  const moving = new Map<string, Route[]>();
  const railSpans: LineSpan[] = [];

  const pushRoute = (store: Map<string, Route[]>, key: string, route: Route) => {
    const list = store.get(key) ?? [];
    list.push(route);
    store.set(key, list);
  };

  for (let ri = 0; ri < roads.length; ri++) {
    const road = roads[ri]!;
    const kind = kindOf(road);
    if (!kind?.trains || road.line.length < 2) continue;
    if (lineLengthM(road.line) < 4) continue;
    const deck = traceDeck(road.line, kind.bridge ? 16 : 24, kind.bridge, kind.stack, sampleAlt, world);
    if (!deck) continue;
    const bucket = buckets?.[ri] ?? 'rail';
    const seed = `${bucket}|${ri}:${road.klass}:${deck[0]!.x.toFixed(0)}`;
    railSpans.push({
      pts: deck,
      speed: kind.speed,
      lateral: 0,
      oneway: kind.oneway,
      gap: 4000,
      seed: `${seed}:rail`,
      spawn: kind.speed > 0 && sparseRail(road.line),
      trucks: false,
      rank: 2,
    });
  }

  if (railSpans.length) {
    const graph = buildGraph(railSpans);
    const seenBucket = new Set<string>();
    for (let i = 0; i < graph.edges.length; i++) {
      const edge = graph.edges[i]!;
      if (!edge.spawn || !edge.legal || edge.length <= 36) continue;
      const bucket = edge.seed.slice(0, edge.seed.indexOf('|'));
      if (seenBucket.has(bucket)) continue;
      seenBucket.add(bucket);
      const wagon = hash01(`${edge.seed}:wag`) < 0.55 ? 'wagonRed' : 'wagonBlue';
      const lead: Route = {
        pts: edge.pts,
        cum: edge.cum,
        length: edge.length,
        speed: edge.speed,
        dist: edge.length * 0.45,
        scale: 1,
        height: 1.2,
        bob: false,
        phase: hash01(`${edge.seed}:zug`) * Math.PI * 2,
        lateral: 0,
        edge: i,
        hops: 0,
        prevEdge: -1,
        trail: [],
        backset: 0,
        graph,
        cruise: paceFor('loco', edge.seed),
        followGap: gapFor('loco'),
      };
      pushRoute(moving, 'loco', lead);
      for (const back of [22, 40]) {
        pushRoute(moving, wagon, { ...lead, speed: 0, dist: Math.max(0, lead.dist - back), follow: lead, backset: back });
      }
    }
  }

  if (moving.size === 0) return null;

  const group = new THREE.Group();
  group.name = 'roads';
  group.frustumCulled = false;

  const addInstances = (geom: THREE.BufferGeometry, routes: Route[], movingFleet: boolean) => {
    const mesh = new THREE.InstancedMesh(geom, ACTOR_MAT, routes.length);
    mesh.userData.sharedGeom = true;
    mesh.frustumCulled = true;
    mesh.renderOrder = 3;
    if (movingFleet) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    paint(mesh, routes);
    mesh.computeBoundingSphere();
    if (movingFleet && mesh.boundingSphere) {
      const center = mesh.boundingSphere.center;
      let radius = mesh.boundingSphere.radius;
      const seen = new Set<TravelGraph>();
      for (const route of routes) {
        const graph = route.graph;
        const lines = graph && !seen.has(graph) ? (seen.add(graph), graph.edges.map((edge) => edge.pts)) : [route.pts];
        for (const pts of lines) {
          for (const p of pts) {
            const reach = Math.hypot(p.x - center.x, p.y - center.y, p.z - center.z);
            if (reach > radius) radius = reach;
          }
        }
      }
      mesh.boundingSphere.radius = radius + 8;
    }
    group.add(mesh);
    return mesh;
  };

  const fleets: Fleet[] = [];
  for (const [key, routes] of moving) {
    const geom = ACTOR_GEOMS[key];
    if (!geom || !routes.length) continue;
    fleets.push({ mesh: addInstances(geom, routes, true), routes });
  }

  if (fleets.length) {
    const rig: RoadRig = {
      tick(dt: number) {
        const byGraph = new Map<TravelGraph, Route[]>();
        for (const fleet of fleets) {
          for (const route of fleet.routes) {
            if (!route.graph || route.follow || route.speed <= 0) continue;
            const list = byGraph.get(route.graph) ?? [];
            list.push(route);
            byGraph.set(route.graph, list);
          }
        }
        const movers: Mover[] = [];
        for (const [graph, routes] of byGraph) movers.push(...draftSameLane(graph, routes, dt));
        yieldAtCrossings(movers);
        for (const mover of movers) {
          mover.route.dist += mover.move;
          advance(mover.route);
        }
        for (const fleet of fleets) {
          for (let i = 0; i < fleet.routes.length; i++) {
            const route = fleet.routes[i]!;
            if (route.follow) advance(route);
            poseAt(route, _pos, _fwd);
            orient(_m, _pos, _fwd, route.scale, route.height);
            fleet.mesh.setMatrixAt(i, _m);
          }
          fleet.mesh.instanceMatrix.needsUpdate = true;
        }
      },
    };
    group.userData.roadRigs = [rig];
  }
  return group;
}
