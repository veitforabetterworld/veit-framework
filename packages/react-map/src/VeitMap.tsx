import {
  BUILTIN_BASEMAPS,
  applyGlobe,
  applyMapTerrain,
  createBasemapController,
  ensureBuildings3dLayer,
  initialBasemapStyle,
  type BasemapController,
  type BasemapDefinition,
  type BasemapSwitchReason,
  type MapTheme,
} from '@veit/map';
import maplibregl, { type Map as MapLibreMap, type MapOptions } from 'maplibre-gl';
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
  projection?: 'globe' | 'mercator';
  /** Shade the globe with the real sun position. Default true. */
  liveSun?: boolean;
  /** Terrain from the configured DEM tiles. Default true. */
  terrain?: boolean;
  /** Extruded OSM buildings. Default true. */
  buildings3d?: boolean;
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

export const VeitMap = forwardRef<VeitMapHandle, VeitMapProps>(function VeitMap(props, ref) {
  const { basemap, theme, basemaps, extraBasemaps, className = 'h-full w-full', children } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const controllerRef = useRef<BasemapController | null>(null);
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
    if (initial.devHandle) (window as unknown as Record<string, unknown>)[initial.devHandle] = instance;

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
        if ((current.projection ?? 'mercator') === 'globe') {
          applyGlobe(m, { liveSun: current.liveSun ?? true });
        } else {
          m.setProjection({ type: 'mercator' });
        }
        if (current.terrain ?? true) applyMapTerrain(m);
        if (current.buildings3d ?? true) ensureBuildings3dLayer(m);
        current.world3d?.attach(m);
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
      propsRef.current.world3d?.dispose(instance);
      instance.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, []);

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
