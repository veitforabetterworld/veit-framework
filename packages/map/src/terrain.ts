import type { Map as MapLibreMap } from 'maplibre-gl';
import { getMapConfig } from './config.js';

/** Raster-DEM for `map.setTerrain` (Terrarium encoding, global SRTM-based tiles). */
export const TERRAIN_DEM_SOURCE_ID = 'terrain-dem';

export const TERRAIN_ATTRIBUTION = 'Geländemodell © Mapzen · SRTM';

export function terrainTilesUrl(): string {
  return getMapConfig().terrain.tilesUrl;
}

export function mapTerrainEnabled(): boolean {
  return getMapConfig().terrain.enabled;
}

export function terrainExaggeration(): number {
  return getMapConfig().terrain.exaggeration;
}

export function terrainDemSourceSpec() {
  return {
    type: 'raster-dem' as const,
    tiles: [terrainTilesUrl()],
    encoding: 'terrarium' as const,
    tileSize: 256,
    maxzoom: 15,
  };
}

export function applyMapTerrain(map: MapLibreMap): void {
  if (!mapTerrainEnabled()) return;
  if (!map.getSource(TERRAIN_DEM_SOURCE_ID)) {
    map.addSource(TERRAIN_DEM_SOURCE_ID, terrainDemSourceSpec());
  }
  map.setTerrain({ source: TERRAIN_DEM_SOURCE_ID, exaggeration: terrainExaggeration() });
}
