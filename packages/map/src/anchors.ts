import type { Map as MapLibreMap } from 'maplibre-gl';
import { getMapConfig } from './config.js';

/** First configured host layer on the map. New map layers go below it. */
export function firstAnchorLayer(map: MapLibreMap): string | undefined {
  return getMapConfig().overlayAnchors.find((id) => map.getLayer(id));
}

/** Moves the configured top layers of the host back on top, keeping their configured order. */
export function raiseAnchorLayers(map: MapLibreMap): void {
  for (const id of getMapConfig().topLayers) {
    if (map.getLayer(id)) map.moveLayer(id);
  }
}
