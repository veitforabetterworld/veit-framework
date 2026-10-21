import {
  BUILTIN_BASEMAPS,
  applyGlobe,
  applyMapTerrain,
  bindMapConfig,
  clearMapTerrain,
  createBasemapController,
  ensureBuildings3dLayer,
  initialBasemapStyle,
  removeBuildings3dLayer,
  type BasemapController,
  type BasemapDefinition,
  type BasemapSwitchReason,
  type MapConfigPatch,
  type MapTheme,
} from '@veit/map';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, MapOptions } from 'maplibre-gl';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { VeitMapContext } from './MapContext.js';

/** What the map needs from a 3D world: attach on every style load, dispose on unmount. */
export type VeitMapWorld3d = {
  attach(map: MapLibreMap): void;
  dispose(map: MapLibreMap): void;
};

export type VeitMapView = {
  center?: [lng: number, lat: number];
  zoom?: number;
  pitch?: number;
  bearing?: number;
};

export type VeitMapProps = {
  /** Id of the active basemap. The host keeps it, so it decides where to persist it. */
  basemap: string;
  theme: MapTheme;
  /** Replaces the built-in basemaps (OSM, satellite, topography, official, cadastral). */
  basemaps?: readonly BasemapDefinition[];
  /** Added after the built-ins, e.g. a land use layer. */
  extraBasemaps?: readonly BasemapDefinition[];
  /** Camera at creation. Later changes are the host's job (`map.flyTo`, ...). */
  initialView?: VeitMapView;
  /**
   * Override snapped onto this map at creation. Merged over `configureMap`.
   * A later change rebinds this map only.
   */
  config?: MapConfigPatch;
  projection?: 'globe' | 'mercator';
  /** Shade the globe with the real sun position. Default true. Applied again when it changes. */
  liveSun?: boolean;
  /** Terrain from the configured DEM tiles. Default true. Applied again when it changes. */
  terrain?: boolean;
  /** Extruded OSM buildings. Default true. Applied again when it changes. */
  buildings3d?: boolean;
  /** Attached on style load and again when this value changes. */
  world3d?: VeitMapWorld3d | null;
  /** Default `compass`. */
  navigationControl?: 'compass' | 'zoom-only' | false;
  /** Passed to `new maplibregl.Map`. Overrides the defaults here, except container and style. */
  mapOptions?: Partial<Omit<MapOptions, 'container' | 'style'>>;
  /** Once, after the first style loaded and the scene is set up. */
  onMapReady?: (map: MapLibreMap) => void;
  /**
   * After every style load (first load, basemap switch, theme switch). Host layers survive a
   * switch; use this to re-ensure ones MapLibre cannot keep, such as images and custom layers.
   */
  onStyleReady?: (map: MapLibreMap, reason: BasemapSwitchReason) => void;
  /** Name under which the map is put on `window`, for console probes. Pass it in dev builds only. */
  devHandle?: string;
  className?: string;
  /** Rendered once the map exists; read it with `useMap()`. */
  children?: ReactNode;
};

export type VeitMapHandle = {
  getMap(): MapLibreMap | null;
};

const DEFAULT_CENTER: [number, number] = [10.45, 51.16];

function applyScene(map: MapLibreMap, current: VeitMapProps, worldRef: { current: VeitMapWorld3d | null }): void {
  if (typeof map.setProjection !== 'function' || !map.getStyle()) return;
  if ((current.projection ?? 'mercator') === 'globe') {
    applyGlobe(map, { liveSun: current.liveSun ?? true });
  } else {
    map.setProjection({ type: 'mercator' });
  }
  if (current.terrain ?? true) applyMapTerrain(map);
  else clearMapTerrain(map);
  if (current.buildings3d ?? true) ensureBuildings3dLayer(map);
  else removeBuildings3dLayer(map);
  const nextWorld = current.world3d ?? null;
  if (worldRef.current !== nextWorld) {
    worldRef.current?.dispose(map);
    worldRef.current = nextWorld;
  }
  nextWorld?.attach(map);
}

export const VeitMap = forwardRef<VeitMapHandle, VeitMapProps>(function VeitMap(props, ref) {
  const {
    basemap,
    theme,
    basemaps,
    extraBasemaps,
    className = 'h-full w-full',
    children,
    projection,
    terrain,
    buildings3d,
    liveSun,
    world3d,
    config,
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const controllerRef = useRef<BasemapController | null>(null);
  const worldRef = useRef<VeitMapWorld3d | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [map, setMap] = useState<MapLibreMap | null>(null);

  const allBasemaps = useMemo(
    () => basemaps ?? [...BUILTIN_BASEMAPS, ...(extraBasemaps ?? [])],
    [basemaps, extraBasemaps],
  );
  const basemapsRef = useRef(allBasemaps);
  basemapsRef.current = allBasemaps;

  useImperativeHandle(ref, () => ({ getMap: () => mapRef.current }), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const initial = propsRef.current;
    const view = initial.initialView ?? {};
    const instance = new maplibregl.Map({
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      maxTileCacheSize: 80,
      fadeDuration: 0,
      maxPitch: 85,
      ...initial.mapOptions,
      container,
      style: initialBasemapStyle(basemapsRef.current, initial.basemap, initial.theme),
      center: view.center ?? DEFAULT_CENTER,
      zoom: view.zoom ?? 5,
      pitch: view.pitch ?? 0,
      bearing: view.bearing ?? 0,
      attributionControl: initial.mapOptions?.attributionControl ?? false,
    });
    mapRef.current = instance;
    bindMapConfig(instance, initial.config);
    const devHandle = initial.devHandle;
    if (devHandle) Reflect.set(window, devHandle, instance);

    const nav = initial.navigationControl ?? 'compass';
    if (nav) {
      instance.addControl(new maplibregl.NavigationControl({ showCompass: nav === 'compass' }), 'top-right');
    }

    let first = true;
    const controller = createBasemapController(instance, {
      basemaps: basemapsRef.current,
      basemap: initial.basemap,
      theme: initial.theme,
      onStyleReady: (m, reason) => {
        const current = propsRef.current;
        applyScene(m, current, worldRef);
        current.onStyleReady?.(m, reason);
        if (first) {
          first = false;
          current.onMapReady?.(m);
          setMap(m);
        }
      },
    });
    controllerRef.current = controller;

    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      controller.dispose();
      controllerRef.current = null;
      worldRef.current?.dispose(instance);
      worldRef.current = null;
      instance.remove();
      mapRef.current = null;
      if (devHandle && Reflect.get(window, devHandle) === instance) Reflect.deleteProperty(window, devHandle);
      setMap(null);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getStyle()) return;
    if (config) bindMapConfig(map, config);
    applyScene(map, propsRef.current, worldRef);
  }, [projection, terrain, buildings3d, liveSun, world3d, config, map]);

  useEffect(() => {
    controllerRef.current?.setBasemap(basemap);
  }, [basemap]);

  useEffect(() => {
    controllerRef.current?.setTheme(theme);
  }, [theme]);

  const context = useMemo(
    () => (map ? { map, basemaps: allBasemaps, basemap, theme } : null),
    [map, allBasemaps, basemap, theme],
  );

  return (
    <div className={className}>
      <div ref={containerRef} className="h-full w-full" />
      {context ? <VeitMapContext.Provider value={context}>{children}</VeitMapContext.Provider> : null}
    </div>
  );
});
