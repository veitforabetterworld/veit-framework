import type { Map as MapLibreMap } from 'maplibre-gl';
import { getMapConfig } from './config.js';

/** Raster-DEM for `map.setTerrain` (Terrarium encoding, global SRTM-based tiles). */
export const TERRAIN_DEM_SOURCE_ID = 'terrain-dem';

export const TERRAIN_ATTRIBUTION = 'Geländemodell © Mapzen · SRTM';

export function terrainTilesUrl(owner?: object): string {
  return getMapConfig(owner).terrain.tilesUrl;
}

export function mapTerrainEnabled(owner?: object): boolean {
  return getMapConfig(owner).terrain.enabled;
}

export function terrainExaggeration(owner?: object): number {
  return getMapConfig(owner).terrain.exaggeration;
}

export function terrainDemSourceSpec(owner?: object) {
  return {
    type: 'raster-dem' as const,
    tiles: [terrainTilesUrl(owner)],
    encoding: 'terrarium' as const,
    tileSize: 256,
    maxzoom: 15,
  };
}

export function applyMapTerrain(map: MapLibreMap): void {
  if (!mapTerrainEnabled(map)) return;
  if (!map.getSource(TERRAIN_DEM_SOURCE_ID)) {
    map.addSource(TERRAIN_DEM_SOURCE_ID, terrainDemSourceSpec(map));
  }
  map.setTerrain({ source: TERRAIN_DEM_SOURCE_ID, exaggeration: terrainExaggeration(map) });
}

/** Drop the DEM source. Pair with a `terrain={false}` prop. */
export function clearMapTerrain(map: MapLibreMap): void {
  if (map.getTerrain()) map.setTerrain(null);
  if (map.getSource(TERRAIN_DEM_SOURCE_ID)) map.removeSource(TERRAIN_DEM_SOURCE_ID);
}
