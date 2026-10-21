import {
  maxZoomForMinScale,
  minZoomForMaxScale,
} from './zoom.js';
import { resolveCadastralStateId } from './stateLookup.js';

export type CadastralStateId =
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

export type CadastralTransport = 'wmts_xyz' | 'wmts_kvp' | 'wms' | 'basemap_de_relief';

type Bounds = {
  south: number;
  north: number;
  west: number;
  east: number;
};

export type CadastralTier = {
  id: 'overview' | 'detail' | 'default';
  minZoom: number;
  maxZoom: number;
  transport: CadastralTransport;
  url: string;
  layers: string;
  styles?: string;
  labelLayers?: string;
  labelUrl?: string;
  wmsVersion?: '1.1.1' | '1.3.0';
  maxNativeZoom?: number;
};

export type CadastralSource = {
  id: CadastralStateId;
  name: string;
  bounds: Bounds;
  /** Höhere Priorität = Stadtstaaten zuerst bei Überlappung. */
  priority: number;
  transport: CadastralTransport;
  url: string;
  /** WMS-Layer (kommasepariert) oder KVP-Basis-URL. */
  layers: string;
  /** WMS-Styles (kommasepariert), optional. */
  styles?: string;
  /** Zusätzliche WMS-Layer für Beschriftung (BW: KVP zweiter Layer). */
  labelLayers?: string;
  /** Zweite WMTS-URL für Beschriftung (BW). */
  labelUrl?: string;
  wmsVersion?: '1.1.1' | '1.3.0';
  maxNativeZoom: number;
  attribution: { short: string; pdf: string };
  previewUrl?: string;
  /** Zoom-abhängige Quellen (Übersicht + Detail). Ohne tiers gilt die Hauptquelle für alle Zoomstufen. */
  tiers?: CadastralTier[];
};

/** AdV-Standard-Flurkarten-Stack (Vektor-WMS). */
const ADV_ALKIS_LAYERS =
  'adv_alkis_flurstuecke,adv_alkis_gebaeude,adv_alkis_tatsaechliche_nutzung';
const ADV_ALKIS_STYLES = 'Farbe,Farbe,Farbe';

const BW_ALKIS_WMTS_KVP_BASE =
  'https://owsproxy.lgl-bw.de/owsproxy/ows/WMTS_LGL-BW_ALKIS_Basis';
const BW_BASISKARTE_WMTS_KVP_BASE =
  'https://owsproxy.lgl-bw.de/owsproxy/ows/WMTS_LGL-BW_Basiskarte';

/** WMTS-GetTile-URL (KVP) als xyz-Template für Baden-Württemberg. */
export function buildBwWmtsXyzTileUrl(
  layer: string,
  baseUrl: string = BW_ALKIS_WMTS_KVP_BASE,
): string {
  return (
    `${baseUrl}?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0` +
    `&LAYER=${encodeURIComponent(layer)}&STYLE=default` +
    `&TILEMATRIXSET=GoogleMapsCompatible` +
    `&TILEMATRIX=GoogleMapsCompatible:{z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png`
  );
}

const PREVIEW_BY = `https://wmtsod1.bayernwolke.de/wmts/by_amtl_karte/smerc/10/544/355`;

/** Hamburg: Layer-Namen sind numerische IDs laut GetCapabilities. */
const HH_DETAIL_LAYERS = '0,1,4,6,13,18,24,26,28';
const HH_DETAIL_STYLES =
  'default,default,default,default,default,default,default,default,default';

/** Kachelzoom bis zu dem Karten angezeigt werden (über maxNativeZoom hinaus hochskaliert). */
export const CADASTRAL_DISPLAY_MAX_ZOOM = 21;

/** Zoom-Grenzen aus offiziellen WMS-Capabilities (Max-/MinScaleDenominator, ~52°N). */
const ZOOM = {
  BE_DETAIL_MIN: minZoomForMaxScale(2550),
  BE_DETAIL_MAX: maxZoomForMinScale(200),
  BE_OVERVIEW_MAX: minZoomForMaxScale(2550) - 1,
  BB_DETAIL_MIN: minZoomForMaxScale(10_000),
  BB_OVERVIEW_MAX: minZoomForMaxScale(10_000) - 1,
  HB_DETAIL_MIN: minZoomForMaxScale(5000),
  HB_OVERVIEW_MAX: minZoomForMaxScale(5000) - 1,
  HH_DETAIL_MIN: minZoomForMaxScale(9543),
  HH_OVERVIEW_MAX: minZoomForMaxScale(9543) - 1,
  /** MV: Flurstücke max. 1:5000; DTK10 für grobe Zoomstufen. */
  MV_DETAIL_MIN: minZoomForMaxScale(5000),
  MV_OVERVIEW_MAX: minZoomForMaxScale(5000) - 1,
  /** SH: ALKIS liefert erst ab ~z16; darunter BDD-Navigation oder basemap.de. */
  SH_DETAIL_MIN: 16,
  SH_OVERVIEW_MAX: 15,
  /** SL: adv_alkis max. 1:10.000 laut WMS-Capabilities. */
  SL_DETAIL_MIN: minZoomForMaxScale(10_000),
  SL_OVERVIEW_MAX: minZoomForMaxScale(10_000) - 1,
  /** SN: Flurstücke max. 1:5000; STYLES weglassen (explizites „Farbe“ bricht den Layer-Stack). */
  SN_DETAIL_MIN: minZoomForMaxScale(5000),
  SN_OVERVIEW_MAX: minZoomForMaxScale(5000) - 1,
  /** HE: he_alk ab ~z16; darunter maßstabsabhängige Kartenübersicht (wms_he_karten). */
  HE_DETAIL_MIN: 16,
  HE_OVERVIEW_MAX: 15,
  /** NW: Flurstücke max. 1:5501; darunter DTK-Kombination (nw_dtk_col). */
  NW_DETAIL_MIN: minZoomForMaxScale(5501),
  NW_OVERVIEW_MAX: minZoomForMaxScale(5501) - 1,
  /** RP: Flurstücke max. 1:7500; STYLES=default erforderlich. */
  RP_DETAIL_MIN: minZoomForMaxScale(7500),
  RP_OVERVIEW_MAX: minZoomForMaxScale(7500) - 1,
  /** NI: ALKIS max. 1:5000; DTK50 für Übersicht. */
  NI_DETAIL_MIN: minZoomForMaxScale(5000),
  NI_OVERVIEW_MAX: minZoomForMaxScale(5000) - 1,
  /** ST: Flurstücke max. 1:5001. */
  ST_DETAIL_MIN: minZoomForMaxScale(5001),
  ST_OVERVIEW_MAX: minZoomForMaxScale(5001) - 1,
  /** TH: ALKISV ab ~z16; STYLES Pflicht. */
  TH_DETAIL_MIN: 16,
  TH_OVERVIEW_MAX: 15,
  /** BW: WMTS-Kacheln erst ab ~z14. */
  BW_DETAIL_MIN: 14,
  BW_OVERVIEW_MAX: 13,
} as const;

/** Berlin-WMS verlangt STYLES= (leer) auch für Default-Style. */
const BE_WMS_STYLES = '';

/** Thüringen ALKISV: je Layer default-Style. */
const TH_ALKIS_LAYERS =
  'FlurstueckGrenzpunkt,AngabeZurGebaeudefunktion,Gewaesser,Siedlung,Vegetation,Verkehr';
const TH_ALKIS_STYLES = 'default,default,default,default,default,default';

/** Direkter WMS-Endpunkt (Mapbender-Proxy liefert für GetMap „Parameter REQUEST invalid“). */
const HE_WMS_BASE =
  'https://www.gds-srv.hessen.de/cgi-bin/lika-services/ogc-free-maps.ows?language=ger';

/** RP Liegenschaften – Mapbender-Proxy unbrauchbar; STYLES sind Pflicht. */
const RP_WMS_BASE = 'https://geo5.service24.rlp.de/wms/liegenschaften_rp.fcgi';
const RP_OVERVIEW_WMS_BASE = 'https://geo4.service24.rlp.de/wms/rp_uek250.fcgi';
const RP_ALKIS_LAYERS = 'Flurstueck,GebaeudeBauwerke,Nutzung';
const RP_ALKIS_STYLES = 'default,default,default';

const BB_OVERVIEW_WMS_URL = 'https://isk.geobasis-bb.de/mapproxy/dtk50farbe/service/wms';
const HH_OVERVIEW_WMS_URL = 'https://geodienste.hamburg.de/HH_WMS_Geobasiskarten';
const SN_OVERVIEW_WMS_URL =
  'https://geodienste.sachsen.de/wms_geosn_dtk-pg-color/guest';
const ST_OVERVIEW_WMS_URL =
  'https://www.geodatenportal.sachsen-anhalt.de/wss/service/ST_LVermGeo_DTK_WMS_OpenData/guest';
const TH_OVERVIEW_WMS_URL =
  'https://www.geoproxy.geoportal-th.de/geoproxy/services/geobasis/UEK';

export const CADASTRAL_SOURCES: CadastralSource[] = [
  {
    id: 'BE',
    name: 'Berlin',
    bounds: { south: 52.34, north: 52.68, west: 13.09, east: 13.76 },
    priority: 100,
    transport: 'wms',
    url: 'https://gdi.berlin.de/services/wms/alkis',
    layers: 'a_alkis_raster',
    wmsVersion: '1.3.0',
    maxNativeZoom: ZOOM.BE_DETAIL_MAX,
    attribution: { short: '© SenBJF/BE', pdf: '© GeoBasis-DE / Senatsverwaltung Berlin' },
    tiers: [
      {
        id: 'overview',
        minZoom: 0,
        maxZoom: ZOOM.BE_OVERVIEW_MAX,
        transport: 'wms',
        url: 'https://gdi.berlin.de/services/wms/k5_farbe',
        layers: 'k5_farbe',
        styles: BE_WMS_STYLES,
        wmsVersion: '1.3.0',
        maxNativeZoom: ZOOM.BE_OVERVIEW_MAX,
      },
      {
        id: 'detail',
        minZoom: ZOOM.BE_DETAIL_MIN,
        maxZoom: CADASTRAL_DISPLAY_MAX_ZOOM,
        transport: 'wms',
        url: 'https://gdi.berlin.de/services/wms/alkis',
        layers: 'a_alkis_raster',
        styles: BE_WMS_STYLES,
        wmsVersion: '1.3.0',
        maxNativeZoom: ZOOM.BE_DETAIL_MAX,
      },
    ],
  },
  {
    id: 'HB',
    name: 'Bremen',
    bounds: { south: 53.01, north: 53.6, west: 8.48, east: 9.01 },
    priority: 100,
    transport: 'wms',
    url: 'https://opendata.lgln.niedersachsen.de/doorman/noauth/alkishb_wms',
    layers: 'ALKIS',
    styles: 'Farbe',
    wmsVersion: '1.3.0',
    maxNativeZoom: 17,
    attribution: { short: '© GeoBremen', pdf: '© GeoBremen, CC BY 4.0' },
    tiers: [
      {
        id: 'overview',
        minZoom: 0,
        maxZoom: ZOOM.HB_OVERVIEW_MAX,
        transport: 'wms',
        url: 'https://geodienste.bremen.de/ABK_farbig',
        layers: 'ABK (farbig)',
        wmsVersion: '1.3.0',
        maxNativeZoom: ZOOM.HB_OVERVIEW_MAX,
      },
      {
        id: 'detail',
        minZoom: ZOOM.HB_DETAIL_MIN,
        maxZoom: CADASTRAL_DISPLAY_MAX_ZOOM,
        transport: 'wms',
        url: 'https://opendata.lgln.niedersachsen.de/doorman/noauth/alkishb_wms',
        layers: 'ALKIS',
        styles: 'Farbe',
        wmsVersion: '1.3.0',
        maxNativeZoom: 17,
      },
    ],
  },
  {
    id: 'HH',
    name: 'Hamburg',
    bounds: { south: 53.39, north: 53.73, west: 9.73, east: 10.33 },
    priority: 100,
    transport: 'wms',
    url: 'https://geodienste.hamburg.de/HH_WMS_ALKIS_Basiskarte_GB',
    layers: HH_DETAIL_LAYERS,
    styles: HH_DETAIL_STYLES,
    wmsVersion: '1.3.0',
    maxNativeZoom: 18,
    attribution: { short: '© LGV HH', pdf: '© Freie und Hansestadt Hamburg, LGV' },
    tiers: [
      {
        id: 'overview',
        minZoom: 0,
        maxZoom: ZOOM.HH_OVERVIEW_MAX,
        transport: 'wms',
        url: HH_OVERVIEW_WMS_URL,
        layers: 'geobasiskarten_farbig',
        styles: 'default',
        wmsVersion: '1.3.0',
        maxNativeZoom: ZOOM.HH_OVERVIEW_MAX,
      },
      {
        id: 'detail',
        minZoom: ZOOM.HH_DETAIL_MIN,
        maxZoom: CADASTRAL_DISPLAY_MAX_ZOOM,
        transport: 'wms',
        url: 'https://geodienste.hamburg.de/HH_WMS_ALKIS_Basiskarte_GB',
        layers: HH_DETAIL_LAYERS,
        styles: HH_DETAIL_STYLES,
        wmsVersion: '1.3.0',
        maxNativeZoom: 18,
      },
    ],
  },
  {
    id: 'SL',
    name: 'Saarland',
    bounds: { south: 49.11, north: 49.64, west: 6.35, east: 7.41 },
    priority: 90,
    transport: 'wms',
    url: 'https://geoportal.saarland.de/geobasisdaten/mapserv?map=/mapfiles/geobasisdaten/Internet/alkis.map',
    layers: 'adv_alkis',
    styles: 'schwarz',
    wmsVersion: '1.3.0',
    maxNativeZoom: 17,
    attribution: { short: '© LVGL SL', pdf: '© Landesvermessung und Geobasisinformation Saarland' },
    tiers: [
      {
        id: 'overview',
        minZoom: 0,
        maxZoom: ZOOM.SL_OVERVIEW_MAX,
        transport: 'wms',
        url: RP_OVERVIEW_WMS_BASE,
        layers: 'rp_uek250',
        styles: BE_WMS_STYLES,
        wmsVersion: '1.3.0',
        maxNativeZoom: ZOOM.SL_OVERVIEW_MAX,
      },
      {
        id: 'detail',
        minZoom: ZOOM.SL_DETAIL_MIN,
        maxZoom: CADASTRAL_DISPLAY_MAX_ZOOM,
        transport: 'wms',
        url: 'https://geoportal.saarland.de/geobasisdaten/mapserv?map=/mapfiles/geobasisdaten/Internet/alkis.map',
        layers: 'adv_alkis',
        styles: 'schwarz',
        wmsVersion: '1.3.0',
        maxNativeZoom: 17,
      },
    ],
  },
  {
    id: 'BY',
    name: 'Bayern',
    bounds: { south: 47.27, north: 50.56, west: 9.92, east: 13.84 },
    priority: 10,
    transport: 'wmts_xyz',
    url: 'https://wmtsod1.bayernwolke.de/wmts/by_amtl_karte/smerc/{z}/{x}/{y}',
    layers: 'by_amtl_karte',
    maxNativeZoom: 19,
    attribution: { short: '© LDBV/BY', pdf: '© Bayerische Vermessungsverwaltung' },
    previewUrl: PREVIEW_BY,
  },
  {
    id: 'BW',
    name: 'Baden-Württemberg',
    bounds: { south: 47.53, north: 49.79, west: 7.51, east: 10.5 },
    priority: 10,
    transport: 'wmts_xyz',
    url: buildBwWmtsXyzTileUrl('ALKIS_Basis'),
    layers: 'ALKIS_Basis',
    labelUrl: buildBwWmtsXyzTileUrl('ALKIS_Beschriftung'),
    maxNativeZoom: 20,
    attribution: { short: '© LGL-BW', pdf: '© LGL Baden-Württemberg, dl-de/by-2-0' },
    tiers: [
      {
        id: 'overview',
        minZoom: 0,
        maxZoom: ZOOM.BW_OVERVIEW_MAX,
        transport: 'wmts_xyz',
        url: buildBwWmtsXyzTileUrl('Basiskarte', BW_BASISKARTE_WMTS_KVP_BASE),
        layers: 'Basiskarte',
        maxNativeZoom: ZOOM.BW_OVERVIEW_MAX,
      },
      {
        id: 'detail',
        minZoom: ZOOM.BW_DETAIL_MIN,
        maxZoom: CADASTRAL_DISPLAY_MAX_ZOOM,
        transport: 'wmts_xyz',
        url: buildBwWmtsXyzTileUrl('ALKIS_Basis'),
        layers: 'ALKIS_Basis',
        labelUrl: buildBwWmtsXyzTileUrl('ALKIS_Beschriftung'),
        maxNativeZoom: 20,
      },
    ],
  },
  {
    id: 'NW',
    name: 'Nordrhein-Westfalen',
    bounds: { south: 50.32, north: 52.53, west: 5.87, east: 9.46 },
    priority: 10,
    transport: 'wms',
    url: 'https://www.wms.nrw.de/geobasis/wms_nw_alkis',
    layers: ADV_ALKIS_LAYERS,
    styles: ADV_ALKIS_STYLES,
    wmsVersion: '1.3.0',
    maxNativeZoom: 17,
    attribution: { short: '© Geobasis NRW', pdf: '© Geobasis NRW, dl-de/zero-2-0' },
    tiers: [
      {
        id: 'overview',
        minZoom: 0,
        maxZoom: ZOOM.NW_OVERVIEW_MAX,
        transport: 'wms',
        url: 'https://www.wms.nrw.de/geobasis/wms_nw_dtk',
        layers: 'nw_dtk_col',
        styles: 'default',
        wmsVersion: '1.3.0',
        maxNativeZoom: ZOOM.NW_OVERVIEW_MAX,
      },
      {
        id: 'detail',
        minZoom: ZOOM.NW_DETAIL_MIN,
        maxZoom: CADASTRAL_DISPLAY_MAX_ZOOM,
        transport: 'wms',
        url: 'https://www.wms.nrw.de/geobasis/wms_nw_alkis',
        layers: ADV_ALKIS_LAYERS,
        styles: ADV_ALKIS_STYLES,
        wmsVersion: '1.3.0',
        maxNativeZoom: 17,
      },
    ],
  },
  {
    id: 'HE',
    name: 'Hessen',
    bounds: { south: 49.39, north: 51.66, west: 7.77, east: 10.24 },
    priority: 10,
    transport: 'wms',
    url: HE_WMS_BASE,
    layers: 'he_alk',
    wmsVersion: '1.3.0',
    maxNativeZoom: 19,
    attribution: { short: '© HVBG/HE', pdf: '© Hessisches Landesamt für Bodenmanagement und Geoinformation' },
    tiers: [
      {
        id: 'overview',
        minZoom: 0,
        maxZoom: ZOOM.HE_OVERVIEW_MAX,
        transport: 'wms',
        url: HE_WMS_BASE,
        layers: 'wms_he_karten',
        wmsVersion: '1.3.0',
        maxNativeZoom: ZOOM.HE_OVERVIEW_MAX,
      },
      {
        id: 'detail',
        minZoom: ZOOM.HE_DETAIL_MIN,
        maxZoom: CADASTRAL_DISPLAY_MAX_ZOOM,
        transport: 'wms',
        url: HE_WMS_BASE,
        layers: 'he_alk',
        wmsVersion: '1.3.0',
        maxNativeZoom: 19,
      },
    ],
  },
  {
    id: 'RP',
    name: 'Rheinland-Pfalz',
    bounds: { south: 48.97, north: 50.94, west: 6.11, east: 8.51 },
    priority: 10,
    transport: 'wms',
    url: RP_WMS_BASE,
    layers: RP_ALKIS_LAYERS,
    styles: RP_ALKIS_STYLES,
    wmsVersion: '1.3.0',
    maxNativeZoom: 18,
    attribution: { short: '© LVermGeoRP', pdf: '© GeoBasis-DE / LVermGeo Rheinland-Pfalz' },
    tiers: [
      {
        id: 'overview',
        minZoom: 0,
        maxZoom: ZOOM.RP_OVERVIEW_MAX,
        transport: 'wms',
        url: RP_OVERVIEW_WMS_BASE,
        layers: 'rp_uek250',
        styles: BE_WMS_STYLES,
        wmsVersion: '1.3.0',
        maxNativeZoom: ZOOM.RP_OVERVIEW_MAX,
      },
      {
        id: 'detail',
        minZoom: ZOOM.RP_DETAIL_MIN,
        maxZoom: CADASTRAL_DISPLAY_MAX_ZOOM,
        transport: 'wms',
        url: RP_WMS_BASE,
        layers: RP_ALKIS_LAYERS,
        styles: RP_ALKIS_STYLES,
        wmsVersion: '1.3.0',
        maxNativeZoom: 18,
      },
    ],
  },
  {
    id: 'NI',
    name: 'Niedersachsen',
    bounds: { south: 51.3, north: 53.89, west: 6.65, east: 11.6 },
    priority: 10,
    transport: 'wms',
    url: 'https://opendata.lgln.niedersachsen.de/doorman/noauth/alkis_wms',
    layers: 'ALKIS',
    styles: 'Farbe',
    wmsVersion: '1.3.0',
    maxNativeZoom: 17,
    attribution: { short: '© LGLN/NI', pdf: '© Landesamt für Geoinformation Niedersachsen, CC BY 4.0' },
    tiers: [
      {
        id: 'overview',
        minZoom: 0,
        maxZoom: ZOOM.NI_OVERVIEW_MAX,
        transport: 'wms',
        url: 'https://opendata.lgln.niedersachsen.de/doorman/noauth/dtk50_wms',
        layers: 'ni_dtk50_farbe',
        styles: BE_WMS_STYLES,
        wmsVersion: '1.3.0',
        maxNativeZoom: ZOOM.NI_OVERVIEW_MAX,
      },
      {
        id: 'detail',
        minZoom: ZOOM.NI_DETAIL_MIN,
        maxZoom: CADASTRAL_DISPLAY_MAX_ZOOM,
        transport: 'wms',
        url: 'https://opendata.lgln.niedersachsen.de/doorman/noauth/alkis_wms',
        layers: 'ALKIS',
        styles: 'Farbe',
        wmsVersion: '1.3.0',
        maxNativeZoom: 17,
      },
    ],
  },
  {
    id: 'BB',
    name: 'Brandenburg',
    bounds: { south: 51.36, north: 53.56, west: 11.27, east: 14.77 },
    priority: 10,
    transport: 'wms',
    url: 'https://isk.geobasis-bb.de/ows/alkis_wms',
    layers: ADV_ALKIS_LAYERS,
    styles: ADV_ALKIS_STYLES,
    wmsVersion: '1.3.0',
    maxNativeZoom: 17,
    attribution: { short: '© LGB/BB', pdf: '© GeoBasis-DE / Landesvermessung Brandenburg' },
    tiers: [
      {
        id: 'overview',
        minZoom: 0,
        maxZoom: ZOOM.BB_OVERVIEW_MAX,
        transport: 'wms',
        url: BB_OVERVIEW_WMS_URL,
        layers: 'bb_dtk50_farbe',
        styles: BE_WMS_STYLES,
        wmsVersion: '1.3.0',
        maxNativeZoom: ZOOM.BB_OVERVIEW_MAX,
      },
      {
        id: 'detail',
        minZoom: ZOOM.BB_DETAIL_MIN,
        maxZoom: CADASTRAL_DISPLAY_MAX_ZOOM,
        transport: 'wms',
        url: 'https://isk.geobasis-bb.de/ows/alkis_wms',
        layers: ADV_ALKIS_LAYERS,
        styles: ADV_ALKIS_STYLES,
        wmsVersion: '1.3.0',
        maxNativeZoom: 17,
      },
    ],
  },
  {
    id: 'MV',
    name: 'Mecklenburg-Vorpommern',
    bounds: { south: 53.11, north: 54.69, west: 10.59, east: 14.41 },
    priority: 10,
    transport: 'wms',
    url: 'https://www.geodaten-mv.de/dienste/alkis_wms',
    layers: ADV_ALKIS_LAYERS,
    styles: ADV_ALKIS_STYLES,
    wmsVersion: '1.3.0',
    maxNativeZoom: 17,
    attribution: { short: '© LVermGeo MV', pdf: '© GeoBasis-DE / Mecklenburg-Vorpommern' },
    tiers: [
      {
        id: 'overview',
        minZoom: 0,
        maxZoom: ZOOM.MV_OVERVIEW_MAX,
        transport: 'wms',
        url: 'https://www.geodaten-mv.de/dienste/gdimv_dtk',
        layers: 'mv_dtk10',
        styles: 'palette_rgb',
        wmsVersion: '1.3.0',
        maxNativeZoom: ZOOM.MV_OVERVIEW_MAX,
      },
      {
        id: 'detail',
        minZoom: ZOOM.MV_DETAIL_MIN,
        maxZoom: CADASTRAL_DISPLAY_MAX_ZOOM,
        transport: 'wms',
        url: 'https://www.geodaten-mv.de/dienste/alkis_wms',
        layers: ADV_ALKIS_LAYERS,
        styles: ADV_ALKIS_STYLES,
        wmsVersion: '1.3.0',
        maxNativeZoom: 17,
      },
    ],
  },
  {
    id: 'SH',
    name: 'Schleswig-Holstein',
    bounds: { south: 53.36, north: 55.06, west: 7.87, east: 11.32 },
    priority: 10,
    transport: 'wms',
    url: 'https://dienste.gdi-sh.de/WMS_SH_ALKIS_OpenGBD',
    layers: 'SH_ALKIS',
    styles: 'default',
    wmsVersion: '1.3.0',
    maxNativeZoom: 17,
    attribution: { short: '© LVermGeo SH', pdf: '© GeoBasis-DE / LVermGeo Schleswig-Holstein' },
    tiers: [
      {
        id: 'overview',
        minZoom: 0,
        maxZoom: ZOOM.SH_OVERVIEW_MAX,
        transport: 'wms',
        url: 'https://dienste.gdi-sh.de/WMS_SH_BDDcol_OpenGBD',
        layers: 'SH_bdd_col',
        styles: 'default',
        wmsVersion: '1.3.0',
        maxNativeZoom: ZOOM.SH_OVERVIEW_MAX,
      },
      {
        id: 'detail',
        minZoom: ZOOM.SH_DETAIL_MIN,
        maxZoom: CADASTRAL_DISPLAY_MAX_ZOOM,
        transport: 'wms',
        url: 'https://dienste.gdi-sh.de/WMS_SH_ALKIS_OpenGBD',
        layers: 'SH_ALKIS',
        styles: 'default',
        wmsVersion: '1.3.0',
        maxNativeZoom: 17,
      },
    ],
  },
  {
    id: 'SN',
    name: 'Sachsen',
    bounds: { south: 50.17, north: 51.68, west: 11.87, east: 15.04 },
    priority: 10,
    transport: 'wms',
    url: 'https://geodienste.sachsen.de/wms_geosn_alkis-adv/guest',
    layers: ADV_ALKIS_LAYERS,
    wmsVersion: '1.3.0',
    maxNativeZoom: 19,
    attribution: { short: '© GeoSN', pdf: '© Landesamt für Geobasisinformation Sachsen' },
    tiers: [
      {
        id: 'overview',
        minZoom: 0,
        maxZoom: ZOOM.SN_OVERVIEW_MAX,
        transport: 'wms',
        url: SN_OVERVIEW_WMS_URL,
        layers: 'sn_dtk_pg_color',
        styles: BE_WMS_STYLES,
        wmsVersion: '1.3.0',
        maxNativeZoom: ZOOM.SN_OVERVIEW_MAX,
      },
      {
        id: 'detail',
        minZoom: ZOOM.SN_DETAIL_MIN,
        maxZoom: CADASTRAL_DISPLAY_MAX_ZOOM,
        transport: 'wms',
        url: 'https://geodienste.sachsen.de/wms_geosn_alkis-adv/guest',
        layers: ADV_ALKIS_LAYERS,
        wmsVersion: '1.3.0',
        maxNativeZoom: 19,
      },
    ],
  },
  {
    id: 'ST',
    name: 'Sachsen-Anhalt',
    bounds: { south: 50.93, north: 53.04, west: 10.56, east: 13.02 },
    priority: 10,
    transport: 'wms',
    url: 'https://geodatenportal.sachsen-anhalt.de/wss/service/ST_LVermGeo_ALKIS_WMS_AdV_konform_App/guest',
    layers: ADV_ALKIS_LAYERS,
    styles: ADV_ALKIS_STYLES,
    wmsVersion: '1.3.0',
    maxNativeZoom: 17,
    attribution: { short: '© LVermGeo ST', pdf: '© Landesvermessungs- und Geobasisinformation Sachsen-Anhalt' },
    tiers: [
      {
        id: 'overview',
        minZoom: 0,
        maxZoom: ZOOM.ST_OVERVIEW_MAX,
        transport: 'wms',
        url: ST_OVERVIEW_WMS_URL,
        layers: 'TUEK_250_col',
        styles: 'default',
        wmsVersion: '1.3.0',
        maxNativeZoom: ZOOM.ST_OVERVIEW_MAX,
      },
      {
        id: 'detail',
        minZoom: ZOOM.ST_DETAIL_MIN,
        maxZoom: CADASTRAL_DISPLAY_MAX_ZOOM,
        transport: 'wms',
        url: 'https://geodatenportal.sachsen-anhalt.de/wss/service/ST_LVermGeo_ALKIS_WMS_AdV_konform_App/guest',
        layers: ADV_ALKIS_LAYERS,
        styles: ADV_ALKIS_STYLES,
        wmsVersion: '1.3.0',
        maxNativeZoom: 17,
      },
    ],
  },
  {
    id: 'TH',
    name: 'Thüringen',
    bounds: { south: 50.2, north: 51.65, west: 9.88, east: 12.65 },
    priority: 10,
    transport: 'wms',
    url: 'https://www.geoproxy.geoportal-th.de/geoproxy/services/ALKISV',
    layers: TH_ALKIS_LAYERS,
    styles: TH_ALKIS_STYLES,
    wmsVersion: '1.1.1',
    maxNativeZoom: 17,
    attribution: { short: '© TLBG/TH', pdf: '© Thüringer Landesamt für Bodenmanagement und Geoinformation' },
    tiers: [
      {
        id: 'overview',
        minZoom: 0,
        maxZoom: ZOOM.TH_OVERVIEW_MAX,
        transport: 'wms',
        url: TH_OVERVIEW_WMS_URL,
        layers: 'th_dtk',
        styles: BE_WMS_STYLES,
        wmsVersion: '1.3.0',
        maxNativeZoom: ZOOM.TH_OVERVIEW_MAX,
      },
      {
        id: 'detail',
        minZoom: ZOOM.TH_DETAIL_MIN,
        maxZoom: CADASTRAL_DISPLAY_MAX_ZOOM,
        transport: 'wms',
        url: 'https://www.geoproxy.geoportal-th.de/geoproxy/services/ALKISV',
        layers: TH_ALKIS_LAYERS,
        styles: TH_ALKIS_STYLES,
        wmsVersion: '1.1.1',
        maxNativeZoom: 17,
      },
    ],
  },
];

const defaultTierCache = new Map<CadastralStateId, CadastralTier[]>();

export function resolveCadastralSource(lat: number, lng: number): CadastralSource | null {
  const stateId = resolveCadastralStateId(lat, lng);
  if (!stateId) return null;
  return CADASTRAL_SOURCES.find((s) => s.id === stateId) ?? null;
}

export function getEffectiveCadastralTiers(source: CadastralSource): CadastralTier[] {
  if (source.tiers && source.tiers.length > 0) return source.tiers;
  const cached = defaultTierCache.get(source.id);
  if (cached) return cached;
  const tiers: CadastralTier[] = [
    {
      id: 'default',
      minZoom: 0,
      maxZoom: CADASTRAL_DISPLAY_MAX_ZOOM,
      transport: source.transport,
      url: source.url,
      layers: source.layers,
      styles: source.styles,
      labelLayers: source.labelLayers,
      labelUrl: source.labelUrl,
      wmsVersion: source.wmsVersion,
      maxNativeZoom: source.maxNativeZoom,
    },
  ];
  defaultTierCache.set(source.id, tiers);
  return tiers;
}

/**
 * Liefert die passende Quelle für den Zoom.
 * Liegt der Zoom außerhalb aller Tier-Grenzen, wird die nächstgelegene Stufe
 * gewählt (Übersicht bei zu weit herausgezoomt, Detail bei zu weit hineingezoomt).
 * Über maxNativeZoom hinaus skaliert MapLibre die Kacheln hoch (leicht verpixelt).
 */
export function resolveCadastralTier(
  source: CadastralSource,
  zoom: number,
): CadastralTier | null {
  const tiers = getEffectiveCadastralTiers(source);
  if (tiers.length === 0) return null;

  const roundedZoom = Math.round(zoom);
  const exact = tiers.find(
    (tier) => roundedZoom >= tier.minZoom && roundedZoom <= tier.maxZoom,
  );
  if (exact) return exact;

  const sorted = [...tiers].sort((a, b) => a.minZoom - b.minZoom);
  if (roundedZoom < sorted[0].minZoom) return sorted[0];
  return sorted[sorted.length - 1];
}

export function isCadastralAvailableAt(lat: number, lng: number): boolean {
  return resolveCadastralSource(lat, lng) !== null;
}

export function getCadastralPreviewUrl(lat: number, lng: number): string {
  const source = resolveCadastralSource(lat, lng);
  return source?.previewUrl ?? PREVIEW_BY;
}

/** KVP-GetTile-URL für Baden-Württemberg WMTS. */
export function buildBwWmtsKvpTileUrl(
  baseUrl: string,
  layer: string,
  z: number,
  x: number,
  y: number,
): string {
  const sep = baseUrl.includes('?') ? '&' : '?';
  return (
    `${baseUrl}${sep}SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0` +
    `&LAYER=${encodeURIComponent(layer)}&STYLE=default` +
    `&TILEMATRIXSET=GoogleMapsCompatible` +
    `&TILEMATRIX=${encodeURIComponent(`GoogleMapsCompatible:${z}`)}` +
    `&TILEROW=${y}&TILECOL=${x}&FORMAT=image/png`
  );
}
