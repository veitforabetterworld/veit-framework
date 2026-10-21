import type { StyleSpecification } from 'maplibre-gl';
import type { BasemapDefinition } from './types.js';

/** Shared glyphs and sprite, so host symbol layers keep working on every basemap. */
export const OPENFREEMAP_GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
export const OPENFREEMAP_SPRITE = 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm';
export const OPENFREEMAP_PLANET_SOURCE = 'https://tiles.openfreemap.org/planet';

export type RasterBasemapOptions = {
  id: string;
  label: string;
  /** Tile URL template (`{z}/{x}/{y}` or `{bbox-epsg-3857}` for WMS). */
  tiles: string;
  maxzoom: number;
  attribution: string;
  attributionLong?: string;
  preview?: string;
  tileSize?: 256 | 512;
  /** Raster resampling; `linear` smooths coarse data such as land cover. */
  resampling?: 'linear' | 'nearest';
  /** Background color under the tiles (visible before they load and on the globe edge). */
  background?: string;
  /** Extra layers drawn on top of the raster, e.g. labels. Their sources go in `sources`. */
  overlay?: Pick<StyleSpecification, 'sources' | 'layers'>;
};

/** Builds a basemap from one raster tile source. Use it for custom layers like land use. */
export function rasterBasemap(options: RasterBasemapOptions): BasemapDefinition {
  const sourceId = `bm-${options.id}`;
  const style: StyleSpecification = {
    version: 8,
    glyphs: OPENFREEMAP_GLYPHS,
    sprite: OPENFREEMAP_SPRITE,
    sources: {
      [sourceId]: {
        type: 'raster',
        tiles: [options.tiles],
        tileSize: options.tileSize ?? 256,
        maxzoom: options.maxzoom,
      },
      ...options.overlay?.sources,
    },
    layers: [
      { id: `${sourceId}-background`, type: 'background', paint: { 'background-color': options.background ?? '#10141a' } },
      { id: sourceId, type: 'raster', source: sourceId, paint: { 'raster-fade-duration': 0, ...(options.resampling ? { 'raster-resampling': options.resampling } : {}) } },
      ...(options.overlay?.layers ?? []),
    ],
  };
  return {
    id: options.id,
    label: options.label,
    style: () => style,
    attribution: options.attribution,
    attributionLong: options.attributionLong,
    preview: options.preview,
  };
}
