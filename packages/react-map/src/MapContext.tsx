import type { BasemapDefinition, MapTheme } from '@veit/map';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createContext, useContext } from 'react';

export type VeitMapContextValue = {
  map: MapLibreMap;
  basemaps: readonly BasemapDefinition[];
  basemap: string;
  theme: MapTheme;
};

export const VeitMapContext = createContext<VeitMapContextValue | null>(null);

/** The map and current basemap state. Only valid below `<VeitMap>`; children render once the map exists. */
export function useVeitMap(): VeitMapContextValue {
  const value = useContext(VeitMapContext);
  if (!value) throw new Error('useVeitMap must be used inside <VeitMap>');
  return value;
}

export function useMap(): MapLibreMap {
  return useVeitMap().map;
}
