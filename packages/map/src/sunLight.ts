import type { Map as MapLibreMap } from 'maplibre-gl';

/** Fixed daylight for 3D buildings once the globe has flattened (matches the world3d scene). */
export const FIXED_LIGHT = {
  anchor: 'map',
  color: '#fff1e0',
  intensity: 0.48,
  position: [1.15, 210, 40],
} as const;

/** Below this zoom the live sun drives the globe shading; above it the fixed building light applies. */
const LIVE_SUN_MAX_ZOOM = 7;
const REFRESH_MS = 60_000;

const RAD = Math.PI / 180;
const refreshers = new WeakMap<MapLibreMap, () => void>();
const wantLiveSun = new WeakMap<MapLibreMap, boolean>();

/** Subsolar point (where the sun stands at the zenith) for a given instant. */
export function subsolarPoint(date: Date): { lat: number; lng: number } {
  const n = date.getTime() / 86_400_000 + 2440587.5 - 2451545.0;
  const meanLongitude = 280.46 + 0.9856474 * n;
  const meanAnomaly = (357.528 + 0.9856003 * n) * RAD;
  const eclipticLongitude = (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * RAD;
  const obliquity = (23.439 - 0.0000004 * n) * RAD;
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude));
  const gmst = (280.46061837 + 360.98564736629 * n) * RAD;
  const lng = ((((rightAscension - gmst) / RAD + 180) % 360) + 360) % 360 - 180;
  return { lat: declination / RAD, lng };
}

/** MapLibre light position [radial, azimuthal, polar] that places the sun above the given surface point. */
export function lightPositionForSun(lat: number, lng: number): [number, number, number] {
  // The map-anchored light lives in globe coordinates (x: 90°E, y: north, z: 0°E) and names where the sun stands.
  const x = Math.sin(lng * RAD) * Math.cos(lat * RAD);
  const y = Math.sin(lat * RAD);
  const z = Math.cos(lng * RAD) * Math.cos(lat * RAD);
  const polar = Math.acos(z) / RAD;
  const azimuth = ((Math.atan2(x, -y) / RAD) + 360) % 360;
  return [1, azimuth, polar];
}

function liveSunLight(date: Date) {
  const { lat, lng } = subsolarPoint(date);
  return {
    anchor: 'map',
    color: '#ffffff',
    intensity: 0.5,
    position: lightPositionForSun(lat, lng),
  } as const;
}

/**
 * Keeps the globe's day/night shading on the real sun: live light when zoomed out,
 * the fixed building light once the 3D city view takes over.
 */
/** Stop the live sun and keep the fixed building light, including after a later zoom. */
export function setFixedLight(map: MapLibreMap): void {
  wantLiveSun.set(map, false);
  try {
    map.setLight({ ...FIXED_LIGHT, position: [...FIXED_LIGHT.position] });
  } catch {
    /* older maplibre */
  }
}

export function bindLiveSunLight(map: MapLibreMap): void {
  wantLiveSun.set(map, true);
  // A style swap resets the light, so a repeated call only re-applies it.
  const bound = refreshers.get(map);
  if (bound) {
    bound();
    return;
  }
  let mode: 'sun' | 'fixed' | null = null;
  const apply = (force = false) => {
    if (wantLiveSun.get(map) === false) {
      if (!force && mode === 'fixed') return;
      mode = 'fixed';
      try {
        map.setLight({ ...FIXED_LIGHT, position: [...FIXED_LIGHT.position] });
      } catch {
        /* older maplibre */
      }
      return;
    }
    const next = map.getZoom() < LIVE_SUN_MAX_ZOOM ? 'sun' : 'fixed';
    if (!force && next === mode) return;
    mode = next;
    try {
      map.setLight(next === 'sun' ? liveSunLight(new Date()) : { ...FIXED_LIGHT, position: [...FIXED_LIGHT.position] });
    } catch {
      /* older maplibre */
    }
  };
  refreshers.set(map, () => apply(true));
  apply(true);
  map.on('zoom', () => apply());
  map.on('style.load', () => apply(true));
  const timer = window.setInterval(() => {
    if (mode === 'sun') apply(true);
  }, REFRESH_MS);
  map.once('remove', () => window.clearInterval(timer));
}
