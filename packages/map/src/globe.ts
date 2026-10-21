import type { Map as MapLibreMap } from 'maplibre-gl';
import { bindLiveSunLight } from './sunLight.js';

export type GlobeOptions = {
  /** Shade the globe with the real sun position (default true). */
  liveSun?: boolean;
};

/** Globe projection with atmosphere; blends into Web Mercator around zoom 11-12. */
export function applyGlobe(map: MapLibreMap, options: GlobeOptions = {}): void {
  map.setProjection({ type: 'globe' });
  map.setSky({
    'sky-color': '#0b2a4a',
    'horizon-color': '#9cc4e8',
    'fog-color': '#cfe3f5',
    'sky-horizon-blend': 0.5,
    'horizon-fog-blend': 0.6,
    'fog-ground-blend': 0.2,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
  });
  if (options.liveSun ?? true) bindLiveSunLight(map);
}
