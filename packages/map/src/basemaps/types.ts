import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import type { MapTheme } from '../types.js';

export type BasemapContext = {
  theme: MapTheme;
  /** First layer that does not belong to the basemap. Layers added by `attach` go below it. */
  beforeId: (map: MapLibreMap) => string | undefined;
};

/**
 * A map background. Vector styles come first (sharp at pitch and on the globe, follow the theme);
 * rasters are wrapped in an inline style. Switching replaces the whole style, host layers stay.
 */
export type BasemapDefinition = {
  id: string;
  label: string;
  /** Style URL or spec for the theme. */
  style: (theme: MapTheme) => string | StyleSpecification;
  /** Credit line for the map's attribution control. Sources may carry their own on top. */
  attribution: string;
  /** Credit line for exports (PDF); falls back to `attribution`. */
  attributionLong?: string;
  /** Thumbnail URL for a switcher. */
  preview?: string;
  /**
   * Runs after the style is loaded: theme contrast, dynamic layers. The returned cleanup runs
   * before the next switch and must remove everything `attach` added.
   */
  attach?: (map: MapLibreMap, ctx: BasemapContext) => void | (() => void);
};
