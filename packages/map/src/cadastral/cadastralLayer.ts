import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  resolveCadastralSource,
  resolveCadastralTier,
  type CadastralSource,
  type CadastralTier,
} from './sources.js';
import { tileZoomOf } from './zoom.js';

export const CADASTRAL_LAYER_ID = 'bm-cadastral';
export const CADASTRAL_LABEL_LAYER_ID = 'bm-cadastral-labels';

function wmsTileUrl(tier: CadastralTier): string {
  const version = tier.wmsVersion ?? '1.3.0';
  const sep = tier.url.includes('?') ? '&' : '?';
  const params = [
    'SERVICE=WMS',
    'REQUEST=GetMap',
    `VERSION=${version}`,
    `LAYERS=${encodeURIComponent(tier.layers)}`,
    `STYLES=${encodeURIComponent(tier.styles ?? '')}`,
    'FORMAT=image/png',
    'TRANSPARENT=false',
    `${version === '1.3.0' ? 'CRS' : 'SRS'}=EPSG:3857`,
    'WIDTH=256',
    'HEIGHT=256',
  ];
  return `${tier.url}${sep}${params.join('&')}&BBOX={bbox-epsg-3857}`;
}

function tileUrl(tier: CadastralTier): string {
  return tier.transport === 'wms' ? wmsTileUrl(tier) : tier.url;
}

type Applied = { key: string };
const applied = new WeakMap<MapLibreMap, Applied>();

function removeCadastral(map: MapLibreMap): void {
  for (const id of [CADASTRAL_LABEL_LAYER_ID, CADASTRAL_LAYER_ID]) {
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  }
  applied.delete(map);
}

function addRaster(
  map: MapLibreMap,
  id: string,
  url: string,
  tier: CadastralTier,
  source: CadastralSource,
  before: string | undefined,
): void {
  map.addSource(id, {
    type: 'raster',
    tiles: [url],
    tileSize: 256,
    maxzoom: tier.maxNativeZoom ?? 19,
    attribution: source.attribution.short,
  });
  map.addLayer(
    { id, type: 'raster', source: id, paint: { 'raster-fade-duration': 0 } },
    before,
  );
}

/**
 * Zeigt die Flurkarte des Bundeslands in der Kartenmitte, in der zum Zoom passenden Stufe
 * (Übersichtskarte oder ALKIS). `before` ist die erste Ebene über den Hintergrundkarten.
 */
export function syncCadastralLayer(map: MapLibreMap, enabled: boolean, before: string | undefined): void {
  if (!enabled) {
    removeCadastral(map);
    return;
  }
  const center = map.getCenter();
  const source = resolveCadastralSource(center.lat, center.lng);
  const tier = source ? resolveCadastralTier(source, tileZoomOf(map.getZoom())) : null;
  if (!source || !tier) {
    removeCadastral(map);
    return;
  }
  const labelUrl = tier.labelUrl ?? '';
  const key = `${source.id}|${tier.id}|${tileUrl(tier)}|${labelUrl}`;
  if (applied.get(map)?.key === key && map.getLayer(CADASTRAL_LAYER_ID)) return;

  removeCadastral(map);
  addRaster(map, CADASTRAL_LAYER_ID, tileUrl(tier), tier, source, before);
  if (labelUrl) addRaster(map, CADASTRAL_LABEL_LAYER_ID, labelUrl, tier, source, before);
  applied.set(map, { key });
}
