import type { Map as MapLibreMap } from 'maplibre-gl';

export type ElevationSample = {
  lng: number;
  lat: number;
  /** Meters along the line from its first point. */
  distance: number;
  /** Meters above sea level as MapLibre draws it (terrain exaggeration included), null while no DEM tile is loaded. */
  elevation: number | null;
};

const EARTH_RADIUS_M = 6_371_008.8;

function haversine(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLng = (b[0] - a[0]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Samples the terrain along a line `[lng, lat][]`. MapLibre has no profile of its own, only
 * `queryTerrainElevation`, so this walks the line in equal steps and asks it per point.
 * Needs terrain enabled and the DEM tiles for the line loaded (zoom close enough to the line).
 */
export function elevationProfile(
  map: MapLibreMap,
  line: readonly [number, number][],
  options: { samples?: number } = {},
): ElevationSample[] {
  if (line.length < 2) return [];
  const legs = line.slice(1).map((p, i) => haversine(line[i], p));
  const total = legs.reduce((sum, d) => sum + d, 0);
  const samples = Math.max(2, Math.round(options.samples ?? 100));
  const out: ElevationSample[] = [];
  let leg = 0;
  let legStart = 0;
  for (let i = 0; i < samples; i += 1) {
    const distance = (total * i) / (samples - 1);
    while (leg < legs.length - 1 && distance > legStart + legs[leg]) {
      legStart += legs[leg];
      leg += 1;
    }
    const t = legs[leg] > 0 ? Math.min(1, Math.max(0, (distance - legStart) / legs[leg])) : 0;
    const lng = line[leg][0] + (line[leg + 1][0] - line[leg][0]) * t;
    const lat = line[leg][1] + (line[leg + 1][1] - line[leg][1]) * t;
    let elevation: number | null = null;
    try {
      const value = map.queryTerrainElevation({ lng, lat });
      if (typeof value === 'number' && Number.isFinite(value)) elevation = value;
    } catch {
      /* terrain not ready */
    }
    out.push({ lng, lat, distance, elevation });
  }
  return out;
}
