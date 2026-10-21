import { syncCadastralLayer } from '../cadastral/cadastralLayer.js';
import type { MapTheme } from '../types.js';
import { applyOsmTheme } from './osmTheme.js';
import { rasterBasemap } from './raster.js';
import { SATELLITE_OVERLAY } from './satelliteOverlay.js';
import type { BasemapDefinition } from './types.js';

export const OPENFREEMAP_DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';
export const OPENFREEMAP_LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/positron';
/** basemap.de web vector style "Relief" (official topography of Germany, BKG, CC BY 4.0). */
export const BASEMAP_DE_VECTOR_STYLE = 'https://sgx.geodatenzentrum.de/gdz_basemapde_vektor/styles/bm_web_top.json';

const BASEMAP_DE_ATTRIBUTION = '© GeoBasis-DE / BKG (basemap.de, CC BY 4.0)';
const BASEMAP_DE_PREVIEW =
  'https://sgx.geodatenzentrum.de/wms_basemapde?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=de_basemapde_web_raster_grau&STYLES=&FORMAT=image/png&CRS=EPSG:3857&WIDTH=160&HEIGHT=120&BBOX=1000000,6200000,1200000,6350000';

/** Vector: OpenFreeMap, light or dark by theme, with water and labels restyled. */
export const osmBasemap: BasemapDefinition = {
  id: 'osm',
  label: 'Standard',
  style: (theme: MapTheme) => (theme === 'dark' ? OPENFREEMAP_DARK_STYLE : OPENFREEMAP_LIGHT_STYLE),
  attribution: '© OpenFreeMap · © OpenMapTiles · © OpenStreetMap',
  attributionLong: '© OpenFreeMap · © OpenStreetMap-Mitwirkende',
  preview: 'https://tile.openstreetmap.org/10/541/343.png',
  attach: (map, ctx) => applyOsmTheme(map, ctx.theme),
};

/** Esri World Imagery raster with roads, borders and place names as a vector overlay. */
export const satelliteBasemap: BasemapDefinition = rasterBasemap({
  id: 'satellite',
  label: 'Satellit',
  tiles: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  maxzoom: 19,
  attribution: '© Esri · © OpenFreeMap · © OpenStreetMap',
  attributionLong: '© Esri · © OpenStreetMap-Mitwirkende',
  preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/10/343/541',
  overlay: SATELLITE_OVERLAY,
});

/** OpenTopoMap raster. There is no keyless vector alternative; "Amtlich" covers Germany. */
export const topoBasemap: BasemapDefinition = rasterBasemap({
  id: 'topo',
  label: 'Topographie',
  tiles: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
  maxzoom: 17,
  attribution: '© OpenTopoMap · © OpenStreetMap',
  preview: 'https://tile.opentopomap.org/10/541/343.png',
  background: '#e9e6dc',
});

/** Vector: basemap.de relief of the BKG. Official topography for Germany only. */
export const officialBasemap: BasemapDefinition = {
  id: 'official',
  label: 'Amtlich',
  style: () => BASEMAP_DE_VECTOR_STYLE,
  attribution: BASEMAP_DE_ATTRIBUTION,
  attributionLong: '© GeoBasis-DE / BKG, CC BY 4.0',
  preview: BASEMAP_DE_PREVIEW,
};

/**
 * Official cadastral map of the state under the map center (ALKIS or overview map by zoom),
 * on top of basemap.de. Outside Germany only basemap.de shows.
 */
export const cadastralBasemap: BasemapDefinition = {
  id: 'cadastral',
  label: 'Flurkarte',
  style: () => BASEMAP_DE_VECTOR_STYLE,
  attribution: BASEMAP_DE_ATTRIBUTION,
  attributionLong: '© Amtliche Flurkarte der Länder · © GeoBasis-DE / BKG',
  attach: (map, ctx) => {
    const sync = () => syncCadastralLayer(map, true, ctx.beforeId(map));
    sync();
    map.on('moveend', sync);
    return () => {
      map.off('moveend', sync);
      syncCadastralLayer(map, false, undefined);
    };
  },
};

export const BUILTIN_BASEMAPS: readonly BasemapDefinition[] = [
  osmBasemap,
  satelliteBasemap,
  topoBasemap,
  officialBasemap,
  cadastralBasemap,
];

