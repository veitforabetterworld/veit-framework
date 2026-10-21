export type MapBbox = [west: number, south: number, east: number, north: number];

export type MapConfig = {
  terrain: {
    enabled: boolean;
    /** Terrarium raster-DEM tiles, `{z}/{x}/{y}` template. */
    tilesUrl: string;
    exaggeration: number;
  };
  /** Extruded OSM buildings from the OpenFreeMap vector tiles. */
  buildings3d: boolean;
  world3d: {
    /** Animated cars and trains. They force a redraw per frame. */
    traffic: boolean;
    /**
     * URL of a backend that aggregates OSM barriers (fences, hedges, single trees, power lines)
     * for a bbox. Without it the 3D world skips that detail level.
     */
    detailUrl: ((bbox: MapBbox) => string) | null;
  };
  /** Host layer ids new map layers (3D buildings) go below; the first one on the map wins. */
  overlayAnchors: string[];
  /** Host layer ids that stay on top after the 3D world raised its own layers, lowest first. */
  topLayers: string[];
};

const DEFAULTS: MapConfig = {
  terrain: {
    enabled: true,
    tilesUrl: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    exaggeration: 1,
  },
  buildings3d: true,
  world3d: { traffic: true, detailUrl: null },
  overlayAnchors: [],
  topLayers: [],
};

let current: MapConfig = DEFAULTS;
/** One config per map. A second map does not inherit a later `configureMap` call. */
const bound = new WeakMap<object, MapConfig>();

export type MapConfigPatch = {
  terrain?: Partial<MapConfig['terrain']>;
  buildings3d?: boolean;
  world3d?: Partial<MapConfig['world3d']>;
  overlayAnchors?: string[];
  topLayers?: string[];
};

function mergeConfig(base: MapConfig, patch: MapConfigPatch): MapConfig {
  return {
    terrain: { ...base.terrain, ...patch.terrain },
    buildings3d: patch.buildings3d ?? base.buildings3d,
    world3d: { ...base.world3d, ...patch.world3d },
    overlayAnchors: patch.overlayAnchors ?? base.overlayAnchors,
    topLayers: patch.topLayers ?? base.topLayers,
  };
}

/** Sets the defaults for maps created afterwards. Does not change a map that already snapped its config. */
export function configureMap(patch: MapConfigPatch): void {
  current = mergeConfig(current, patch);
}

/** Snap a map to the current defaults, plus an optional override. Later `configureMap` calls leave it alone. */
export function bindMapConfig(owner: object, patch?: MapConfigPatch): MapConfig {
  const config = mergeConfig(current, patch ?? {});
  bound.set(owner, config);
  return config;
}

/** The config snapped to `owner`, or the app defaults when the owner has none. */
export function getMapConfig(owner?: object): MapConfig {
  if (owner) {
    const own = bound.get(owner);
    if (own) return own;
  }
  return current;
}
