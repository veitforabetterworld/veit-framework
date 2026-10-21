import { getMapConfig } from '../config.js';

export const WORLD3D_LAYER_ID = 'osm-world-3d';
/**
 * Below this zoom the globe is still curved (MapLibre blends to Web Mercator around zoom 11-12),
 * and the three.js scene is built in local mercator meters. Do not fetch or draw it there.
 */
export const WORLD3D_MIN_ZOOM = 11;
/** Animated traffic only pays off when cars are visible, and it forces a full map redraw per frame. */
export const WORLD3D_TRAFFIC_MIN_ZOOM = 14;
/** ~24 fps for traffic. Camera motion still renders at the display rate. */
export const WORLD3D_TRAFFIC_FRAME_MS = 42;

export function world3dTrafficEnabled(owner?: object): boolean {
  return getMapConfig(owner).world3d.traffic;
}
export const world3dAttribution = '3D-Welt © OpenStreetMap · OpenFreeMap · Terrarium DEM';
