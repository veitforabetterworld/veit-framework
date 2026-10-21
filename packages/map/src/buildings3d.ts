import type { Map as MapLibreMap } from 'maplibre-gl';
import { firstAnchorLayer } from './anchors.js';
import { getMapConfig } from './config.js';

/** OpenFreeMap planet tiles (OpenMapTiles schema, OSM buildings with render_height). */
export const BUILDINGS3D_SOURCE_ID = 'osm-buildings-vt';
export const BUILDINGS3D_LAYER_ID = 'osm-buildings-3d';
export const BUILDINGS3D_ROOF_LAYER_ID = 'osm-buildings-roof';

const OPENFREEMAP_PLANET = 'https://tiles.openfreemap.org/planet';

export function mapBuildings3dEnabled(): boolean {
  return getMapConfig().buildings3d;
}

export const BUILDINGS3D_ATTRIBUTION = '3D-Gebäude © OpenFreeMap · OpenMapTiles · OSM';

/** OSM building extrusions (Simple 3D Buildings heights), similar in spirit to Organic Maps. */
export function ensureBuildings3dLayer(map: MapLibreMap): void {
  if (!mapBuildings3dEnabled()) return;

  if (!map.getSource(BUILDINGS3D_SOURCE_ID)) {
    map.addSource(BUILDINGS3D_SOURCE_ID, {
      type: 'vector',
      url: OPENFREEMAP_PLANET,
      minzoom: 0,
      maxzoom: 14,
    });
  }

  if (map.getLayer(BUILDINGS3D_LAYER_ID)) return;

  const before = firstAnchorLayer(map);
  map.addLayer(
    {
      id: BUILDINGS3D_LAYER_ID,
      type: 'fill-extrusion',
      source: BUILDINGS3D_SOURCE_ID,
      'source-layer': 'building',
      minzoom: 13,
      filter: ['!=', ['get', 'hide_3d'], true],
      paint: {
        'fill-extrusion-color': [
          'case',
          ['has', 'colour'],
          ['to-color', ['get', 'colour']],
          [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'render_height'], 8],
            6,
            'hsl(32, 14%, 78%)',
            14,
            'hsl(26, 10%, 70%)',
            28,
            'hsl(220, 6%, 62%)',
          ],
        ],
        'fill-extrusion-height': [
          'max',
          ['coalesce', ['get', 'render_height'], 0],
          5,
        ],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 1,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    before,
  );
}
