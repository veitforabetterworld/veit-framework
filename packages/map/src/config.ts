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

export type MapConfigPatch = {
  terrain?: Partial<MapConfig['terrain']>;
  buildings3d?: boolean;
  world3d?: Partial<MapConfig['world3d']>;
  overlayAnchors?: string[];
  topLayers?: string[];
};

/** Sets defaults once at app start. Later calls merge into the current values. */
export function configureMap(patch: MapConfigPatch): void {
  current = {
    terrain: { ...current.terrain, ...patch.terrain },
    buildings3d: patch.buildings3d ?? current.buildings3d,
    world3d: { ...current.world3d, ...patch.world3d },
    overlayAnchors: patch.overlayAnchors ?? current.overlayAnchors,
    topLayers: patch.topLayers ?? current.topLayers,
  };
}

export function getMapConfig(): MapConfig {
  return current;
}
