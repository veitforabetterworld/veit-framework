import {
  STATE_BOUNDARIES,
  type PolygonCoords,
  type Ring,
  type StateFeature,
} from './stateBoundaries.js';

/** ISO 3166-2:DE-Kürzel ohne Präfix, passend zu CadastralStateId. */
export type GermanStateCode =
  | 'BE'
  | 'BB'
  | 'BW'
  | 'BY'
  | 'HB'
  | 'HH'
  | 'HE'
  | 'MV'
  | 'NI'
  | 'NW'
  | 'RP'
  | 'SL'
  | 'SN'
  | 'ST'
  | 'SH'
  | 'TH';

const STATE_FEATURES = STATE_BOUNDARIES.features;

const stateIdByIso = new Map<string, GermanStateCode>();
for (const feature of STATE_FEATURES) {
  const iso = feature.properties.id;
  const id = iso.replace(/^DE-/, '') as GermanStateCode;
  stateIdByIso.set(iso, id);
}

/** Ray-casting; Ring-Koordinaten sind GeoJSON [lng, lat]. */
function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygonCoords(lng: number, lat: number, polygons: PolygonCoords): boolean {
  if (polygons.length === 0) return false;
  if (!pointInRing(lng, lat, polygons[0])) return false;
  for (let h = 1; h < polygons.length; h++) {
    if (pointInRing(lng, lat, polygons[h])) return false;
  }
  return true;
}

function pointInGeometry(
  lng: number,
  lat: number,
  geometry: StateFeature['geometry'],
): boolean {
  if (geometry.type === 'Polygon') {
    return pointInPolygonCoords(lng, lat, geometry.coordinates);
  }
  for (const polygon of geometry.coordinates) {
    if (pointInPolygonCoords(lng, lat, polygon)) return true;
  }
  return false;
}

/**
 * Ermittelt das Bundesland anhand der exakten Verwaltungsgrenze (Point-in-Polygon).
 * Koordinaten: WGS84.
 */
export function resolveCadastralStateId(lat: number, lng: number): GermanStateCode | null {
  for (const feature of STATE_FEATURES) {
    if (pointInGeometry(lng, lat, feature.geometry)) {
      return stateIdByIso.get(feature.properties.id) ?? null;
    }
  }
  return null;
}
