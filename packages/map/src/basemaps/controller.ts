import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import type { MapTheme } from '../types.js';
import type { BasemapContext, BasemapDefinition } from './types.js';

export type BasemapSwitchReason = 'initial' | 'basemap' | 'theme';

export type BasemapControllerOptions = {
  basemaps: readonly BasemapDefinition[];
  basemap: string;
  theme: MapTheme;
  /**
   * Runs after every style load once the basemap is attached (first load, basemap switch,
   * theme switch). Host layers survive a switch; use this to re-ensure ones MapLibre cannot keep,
   * such as images and custom layers.
   */
  onStyleReady?: (map: MapLibreMap, reason: BasemapSwitchReason) => void;
};

export type BasemapController = {
  readonly basemap: string;
  readonly theme: MapTheme;
  setBasemap(id: string): void;
  setTheme(theme: MapTheme): void;
  dispose(): void;
};

type PreviousStyle = StyleSpecification;

/** Style the map is created with. Pair it with `createBasemapController` after construction. */
export function initialBasemapStyle(
  basemaps: readonly BasemapDefinition[],
  id: string,
  theme: MapTheme,
): string | StyleSpecification {
  return findBasemap(basemaps, id).style(theme);
}

function findBasemap(basemaps: readonly BasemapDefinition[], id: string): BasemapDefinition {
  const found = basemaps.find((b) => b.id === id) ?? basemaps[0];
  if (!found) throw new Error('No basemaps registered');
  return found;
}

/**
 * Layers and sources the host added, copied onto the incoming basemap style.
 * Custom layers are left out: MapLibre keeps their id and drops the implementation,
 * so the owner (the 3D world, `useMapLayer`) adds them again after `style.load`.
 */
export function carryHostStyle(
  previous: StyleSpecification | undefined,
  next: StyleSpecification,
  owned: { layers: ReadonlySet<string>; sources: ReadonlySet<string> },
): { style: StyleSpecification; own: { layers: Set<string>; sources: Set<string> } } {
  const own = {
    layers: new Set(next.layers.map((layer) => layer.id)),
    sources: new Set(Object.keys(next.sources)),
  };
  if (!previous) return { style: next, own };
  const keptLayers = previous.layers.filter((layer) => {
    // Custom layers are not in the style spec, but getStyle() still returns them.
    const type = (layer as { type: string }).type;
    return type !== 'custom' && !owned.layers.has(layer.id) && !own.layers.has(layer.id);
  });
  const keptSources = Object.fromEntries(
    Object.entries(previous.sources).filter(([id]) => !owned.sources.has(id) && !own.sources.has(id)),
  );
  return {
    own,
    style: {
      ...next,
      sources: { ...next.sources, ...keptSources },
      layers: [...next.layers, ...keptLayers],
      terrain: previous.terrain ?? next.terrain,
      sky: previous.sky ?? next.sky,
      light: previous.light ?? next.light,
      projection: previous.projection ?? next.projection,
    },
  };
}

/**
 * Switches the whole style for a basemap or theme change and keeps everything the host added:
 * layers, sources, terrain, sky, light and projection are carried into the new style.
 * Custom layers are not carried; add them again from `onStyleReady`.
 */
export function createBasemapController(map: MapLibreMap, options: BasemapControllerOptions): BasemapController {
  let basemapId = findBasemap(options.basemaps, options.basemap).id;
  let theme = options.theme;
  /** Ids that belong to the current basemap style. Everything else is host-owned. */
  let ownLayers = new Set<string>();
  let ownSources = new Set<string>();
  let nextOwn: { layers: Set<string>; sources: Set<string> } | null = null;
  let cleanup: (() => void) | null = null;
  let reason: BasemapSwitchReason = 'initial';
  let disposed = false;
  let applied = false;

  const ctx = (): BasemapContext => ({
    theme,
    beforeId: (m) => m.getStyle().layers.find((layer) => !ownLayers.has(layer.id))?.id,
  });

  const onStyleLoad = () => {
    if (disposed) return;
    if (nextOwn) {
      ownLayers = nextOwn.layers;
      ownSources = nextOwn.sources;
      nextOwn = null;
    } else if (!applied) {
      const style = map.getStyle();
      ownLayers = new Set(style.layers.map((layer) => layer.id));
      ownSources = new Set(Object.keys(style.sources));
    }
    applied = true;
    const def = findBasemap(options.basemaps, basemapId);
    cleanup = def.attach?.(map, ctx()) ?? null;
    options.onStyleReady?.(map, reason);
    reason = 'basemap';
  };
  map.on('style.load', onStyleLoad);
  if (map.isStyleLoaded()) onStyleLoad();

  const transformStyle = (previous: PreviousStyle | undefined, next: PreviousStyle): PreviousStyle => {
    const carried = carryHostStyle(previous, next, { layers: ownLayers, sources: ownSources });
    nextOwn = carried.own;
    return carried.style;
  };

  const swap = (why: BasemapSwitchReason) => {
    const def = findBasemap(options.basemaps, basemapId);
    cleanup?.();
    cleanup = null;
    reason = why;
    map.setStyle(def.style(theme), { diff: false, transformStyle });
  };

  return {
    get basemap() {
      return basemapId;
    },
    get theme() {
      return theme;
    },
    setBasemap(id) {
      const next = findBasemap(options.basemaps, id).id;
      if (next === basemapId) return;
      basemapId = next;
      swap('basemap');
    },
    setTheme(next) {
      if (next === theme) return;
      theme = next;
      swap('theme');
    },
    dispose() {
      disposed = true;
      map.off('style.load', onStyleLoad);
      cleanup?.();
      cleanup = null;
    },
  };
}
