import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { OPENFREEMAP_PLANET_SOURCE } from './raster.js';

const SOURCE = 'openmaptiles';
const LABEL = '#f5f7fa';

const placeName: ExpressionSpecification = [
  'case',
  ['has', 'name:nonlatin'],
  ['concat', ['get', 'name:latin'], '\n', ['get', 'name:nonlatin']],
  ['coalesce', ['get', 'name_en'], ['get', 'name']],
];

const roadName: ExpressionSpecification = [
  'case',
  ['has', 'name:nonlatin'],
  ['concat', ['get', 'name:latin'], ' ', ['get', 'name:nonlatin']],
  ['coalesce', ['get', 'name_en'], ['get', 'name']],
];

const noTunnelOrBridge: ExpressionSpecification = ['match', ['get', 'brunnel'], ['bridge', 'tunnel'], false, true];

function road(
  id: string,
  classes: string[],
  minzoom: number,
  color: string,
  width: [number, number, number, number],
  extra: ExpressionSpecification[] = [],
): LayerSpecification {
  return {
    id: `overlay_${id}`,
    type: 'line',
    source: SOURCE,
    'source-layer': 'transportation',
    minzoom,
    filter: ['all', ['match', ['get', 'class'], classes, true, false], noTunnelOrBridge, ...extra],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': color,
      'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], width[0], width[1], 18, width[3]],
    },
  } as LayerSpecification;
}

function roadLabel(id: string, classes: string[], minzoom: number, size: [number, number]): LayerSpecification {
  return {
    id: `overlay_${id}`,
    type: 'symbol',
    source: SOURCE,
    'source-layer': 'transportation_name',
    minzoom,
    filter: ['match', ['get', 'class'], classes, true, false],
    layout: {
      'symbol-placement': 'line',
      'text-field': roadName,
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], minzoom, size[0], 18, size[1]],
      'text-max-width': 8,
    },
    paint: { 'text-color': LABEL, 'text-halo-color': 'rgba(0,0,0,0.75)', 'text-halo-width': 1.5 },
  } as LayerSpecification;
}

function placeLabel(
  id: string,
  cls: string,
  zoom: { min: number; max?: number },
  font: string,
  size: [number, number, number, number],
  extraLayout: Record<string, unknown> = {},
  paint: Record<string, unknown> = {},
): LayerSpecification {
  return {
    id: `overlay_${id}`,
    type: 'symbol',
    source: SOURCE,
    'source-layer': 'place',
    minzoom: zoom.min,
    ...(zoom.max != null ? { maxzoom: zoom.max } : {}),
    filter: ['==', ['get', 'class'], cls],
    layout: {
      'text-field': placeName,
      'text-font': [font],
      'text-size': ['interpolate', ['linear'], ['zoom'], size[0], size[1], size[2], size[3]],
      'text-anchor': 'center',
      ...extraLayout,
    },
    paint: { 'text-color': LABEL, 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.5, ...paint },
  } as LayerSpecification;
}

/**
 * Roads, borders and place names drawn over satellite imagery. Zoom ranges follow the
 * OpenFreeMap schema; layers were ported from plenivo.
 */
export const SATELLITE_OVERLAY: Pick<StyleSpecification, 'sources' | 'layers'> = {
  sources: { [SOURCE]: { type: 'vector', url: OPENFREEMAP_PLANET_SOURCE } },
  layers: [
    {
      id: 'overlay_boundary',
      type: 'line',
      source: SOURCE,
      'source-layer': 'boundary',
      minzoom: 4,
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      paint: {
        'line-color': 'rgba(255,255,255,0.45)',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 10, 1.5],
        'line-dasharray': [2, 1],
      },
    } as LayerSpecification,
    {
      ...road('road_minor', ['minor', 'service', 'track'], 13, 'rgba(255,255,255,0.72)', [13, 0.5, 18, 4], [
        ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
      ]),
    },
    road('road_secondary_tertiary', ['secondary', 'tertiary'], 8, 'rgba(255,236,179,0.92)', [8, 0.5, 18, 8]),
    road('road_primary_trunk', ['primary', 'trunk'], 6, 'rgba(255,220,130,0.95)', [6, 0.6, 18, 10]),
    road('road_motorway', ['motorway'], 5, 'rgba(255,190,90,0.95)', [5, 0.5, 18, 12], [['!=', ['get', 'ramp'], 1]]),
    roadLabel('highway_name_minor', ['minor', 'service', 'track'], 14, [11, 13]),
    roadLabel('highway_name_major', ['primary', 'secondary', 'tertiary', 'trunk'], 12, [11, 14]),
    placeLabel('label_village', 'village', { min: 10 }, 'Noto Sans Regular', [10, 10, 14, 12]),
    placeLabel('label_town', 'town', { min: 8 }, 'Noto Sans Regular', [8, 11, 14, 14]),
    placeLabel('label_city', 'city', { min: 5 }, 'Noto Sans Bold', [5, 12, 12, 18], {}, { 'text-halo-width': 2 }),
    placeLabel(
      'label_state',
      'state',
      { min: 4, max: 9 },
      'Noto Sans Italic',
      [4, 10, 8, 14],
      { 'text-transform': 'uppercase', 'text-letter-spacing': 0.15 },
      { 'text-color': 'rgba(255,255,255,0.9)', 'text-halo-color': 'rgba(0,0,0,0.75)' },
    ),
    placeLabel('label_country', 'country', { min: 2, max: 8 }, 'Noto Sans Bold', [2, 10, 6, 16], {}, { 'text-halo-width': 2 }),
  ],
};
