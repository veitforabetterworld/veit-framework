import type { Map as MapLibreMap } from 'maplibre-gl';

/** maplibre-gl 5 does not export ExpressionSpecification. Expressions are passed straight to setPaintProperty. */
type ExpressionSpecification = [string, ...unknown[]];
import {
  BUILDINGS3D_LAYER_ID,
  BUILDINGS3D_SOURCE_ID,
  ensureBuildings3dLayer,
} from '../buildings3d.js';
import { firstAnchorLayer, raiseAnchorLayers } from '../anchors.js';
import { WORLD3D_LAYER_ID } from './constants.js';

export const WORLD3D_ROADS_LAYER_ID = 'world3d-roads';
export const WORLD3D_ROADS_CASING_ID = 'world3d-roads-casing';
export const WORLD3D_WATER_LAYER_ID = 'world3d-water';
export const WORLD3D_WATERWAY_LAYER_ID = 'world3d-waterway';
export const WORLD3D_WOOD_LAYER_ID = 'world3d-wood';

const CARTOON_IDS = [WORLD3D_WOOD_LAYER_ID, WORLD3D_ROADS_CASING_ID, WORLD3D_ROADS_LAYER_ID] as const;
const WATER_IDS = [WORLD3D_WATER_LAYER_ID, WORLD3D_WATERWAY_LAYER_ID] as const;

const BUILDING_HEIGHT: ExpressionSpecification = ['max', ['coalesce', ['get', 'render_height'], 0], 5];
const BUILDING_WALL_COLOR: ExpressionSpecification = [
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
];

function addLayerOnce(map: MapLibreMap, layer: Parameters<MapLibreMap['addLayer']>[0], before?: string): void {
  const id = (layer as { id: string }).id;
  if (map.getLayer(id)) return;
  map.addLayer(layer, before);
}

function applyBuildingLook(map: MapLibreMap): void {
  if (!map.getLayer(BUILDINGS3D_LAYER_ID)) return;
  map.setLayerZoomRange(BUILDINGS3D_LAYER_ID, 13, 24);
  map.setPaintProperty(BUILDINGS3D_LAYER_ID, 'fill-extrusion-height', BUILDING_HEIGHT);
  map.setPaintProperty(BUILDINGS3D_LAYER_ID, 'fill-extrusion-base', ['coalesce', ['get', 'render_min_height'], 0]);
  map.setPaintProperty(BUILDINGS3D_LAYER_ID, 'fill-extrusion-opacity', 1);
  map.setPaintProperty(BUILDINGS3D_LAYER_ID, 'fill-extrusion-vertical-gradient', true);
  map.setPaintProperty(BUILDINGS3D_LAYER_ID, 'fill-extrusion-color', BUILDING_WALL_COLOR);
}

/** Roads, water and extruded buildings that sit on MapLibre-Terrain (no Three.js). */
export function ensureWorld3dStyleLayers(map: MapLibreMap): void {
  ensureBuildings3dLayer(map);
  if (!map.getSource(BUILDINGS3D_SOURCE_ID)) return;

  const before = firstAnchorLayer(map);

  addLayerOnce(
    map,
    {
      id: WORLD3D_WATER_LAYER_ID,
      type: 'fill',
      source: BUILDINGS3D_SOURCE_ID,
      'source-layer': 'water',
      minzoom: 12,
      layout: { visibility: 'none' },
      paint: {
        'fill-color': '#1c4d68',
        'fill-opacity': 0.28,
      },
    },
    before,
  );

  addLayerOnce(
    map,
    {
      id: WORLD3D_WATERWAY_LAYER_ID,
      type: 'line',
      source: BUILDINGS3D_SOURCE_ID,
      'source-layer': 'waterway',
      minzoom: 13,
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#1c4d68',
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 13, 0.8, 18, 4],
        'line-opacity': 0.35,
      },
    },
    before,
  );

  applyBuildingLook(map);
}

export function setWorld3dStyleVisible(map: MapLibreMap, visible: boolean): void {
  ensureWorld3dStyleLayers(map);
  const water = visible ? 'visible' : 'none';
  for (const id of WATER_IDS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', water);
  }
  for (const id of CARTOON_IDS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
  }
  if (map.getLayer(BUILDINGS3D_LAYER_ID)) {
    map.setLayoutProperty(BUILDINGS3D_LAYER_ID, 'visibility', 'visible');
    map.setPaintProperty(BUILDINGS3D_LAYER_ID, 'fill-extrusion-opacity', 1);
    applyBuildingLook(map);
  }
  raiseWorld3dStyleLayers(map);
}

export function raiseWorld3dStyleLayers(map: MapLibreMap): void {
  for (const id of [...WATER_IDS, BUILDINGS3D_LAYER_ID]) {
    if (map.getLayer(id)) map.moveLayer(id);
  }
  if (map.getLayer(WORLD3D_LAYER_ID)) map.moveLayer(WORLD3D_LAYER_ID);
  raiseAnchorLayers(map);
}
