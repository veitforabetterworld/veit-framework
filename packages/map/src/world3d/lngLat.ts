import * as maplibregl from 'maplibre-gl';
import * as THREE from 'three';

export type WorldOrigin = {
  lng: number;
  lat: number;
  alt: number;
};

/** Keep the scene origin still while the camera pans. Altitude stays 0 so heights stay in MapLibre mercator units. */
export function stickyWorldOrigin(lng: number, lat: number, _alt = 0): WorldOrigin {
  const qLng = 0.008;
  const qLat = 0.006;
  return {
    lng: Math.round(lng / qLng) * qLng,
    lat: Math.round(lat / qLat) * qLat,
    alt: 0,
  };
}

function originMercator(origin: WorldOrigin): maplibregl.MercatorCoordinate {
  return maplibregl.MercatorCoordinate.fromLngLat({ lon: origin.lng, lat: origin.lat }, origin.alt);
}

/**
 * Local meters whose T·S(ppm,-ppm,ppm) transform is an exact inverse of MapLibre mercator.
 * Same placement space as fill-extrusion buildings — no flat-earth ENU.
 */
export function enu(origin: WorldOrigin, lng: number, lat: number, altM: number): THREE.Vector3 {
  const o = originMercator(origin);
  const p = maplibregl.MercatorCoordinate.fromLngLat({ lon: lng, lat }, altM);
  const ppm = o.meterInMercatorCoordinateUnits();
  return new THREE.Vector3((p.x - o.x) / ppm, (p.y - o.y) / -ppm, (p.z - o.z) / ppm);
}

/** `enu` for many points: the origin mercator and scale are computed once. Writes into `out`. */
export function enuMapper(
  origin: WorldOrigin,
): (lng: number, lat: number, altM: number, out: [number, number, number]) => void {
  const o = originMercator(origin);
  const ppm = o.meterInMercatorCoordinateUnits();
  return (lng, lat, altM, out) => {
    const p = maplibregl.MercatorCoordinate.fromLngLat({ lon: lng, lat }, altM);
    out[0] = (p.x - o.x) / ppm;
    out[1] = (p.y - o.y) / -ppm;
    out[2] = (p.z - o.z) / ppm;
  };
}

/** Y-up meter mesh (tree, post) → mercator-local Z-up. */
export function yUpEnuMatrix(
  origin: WorldOrigin,
  lng: number,
  lat: number,
  altM: number,
  scale = 1,
  yaw = 0,
): THREE.Matrix4 {
  const p = enu(origin, lng, lat, altM);
  const t = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z);
  const rx = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  const ry = new THREE.Matrix4().makeRotationY(yaw);
  const sc = new THREE.Matrix4().makeScale(scale, scale, scale);
  return t.multiply(rx).multiply(ry).multiply(sc);
}

export function mercatorVec(lng: number, lat: number, altM = 0): THREE.Vector3 {
  const m = maplibregl.MercatorCoordinate.fromLngLat({ lon: lng, lat }, altM);
  return new THREE.Vector3(m.x, m.y, m.z);
}

export function mapWorldSize(map: { transform: { worldSize: number } }): number {
  return map.transform.worldSize;
}

export function ringAreaM2(ring: [number, number][]): number {
  if (ring.length < 3) return 0;
  const lat0 = ring[0]![1];
  const mx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lng0, latA] = ring[i]!;
    const [lng1, latB] = ring[(i + 1) % ring.length]!;
    const x0 = lng0 * mx;
    const y0 = latA * 111320;
    const x1 = lng1 * mx;
    const y1 = latB * 111320;
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
}

export function pointInRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0];
    const yi = ring[i]![1];
    const xj = ring[j]![0];
    const yj = ring[j]![1];
    const hit = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

export function ringBbox(ring: [number, number][]): [number, number, number, number] {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return [west, south, east, north];
}
