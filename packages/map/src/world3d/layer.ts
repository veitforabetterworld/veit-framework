import maplibregl, { type CustomLayerInterface, type Map as MapLibreMap } from 'maplibre-gl';
import * as THREE from 'three';
import { terrainExaggeration } from '../terrain.js';
import {
  WORLD3D_LAYER_ID,
  WORLD3D_MIN_ZOOM,
  WORLD3D_TRAFFIC_FRAME_MS,
  WORLD3D_TRAFFIC_MIN_ZOOM,
  world3dTrafficEnabled,
} from './constants.js';
import { DemCache } from './demTiles.js';
import { enu, stickyWorldOrigin, type WorldOrigin } from './lngLat.js';
import { OsmTileStream } from './osmStream.js';
import { DetailLod } from './overpass.js';
import { ensureWorld3dStyleLayers, raiseWorld3dStyleLayers, setWorld3dStyleVisible } from './styleLayers.js';
import { focusBbox } from './tileMath.js';

export { WORLD3D_LAYER_ID, world3dAttribution } from './constants.js';

export type World3dView = {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
  world: WorldOrigin;
};

/** Extra scene content from the host app, e.g. a water surface. Meshes use the view's world origin. */
export interface World3dPlugin {
  readonly group: THREE.Group;
  sync(view: World3dView): Promise<void>;
  /** Drop requests in flight when the world origin moved. */
  discardInflight?(): void;
  dispose(): void;
}

export type World3dPluginFactory = (sampleAlt: (lng: number, lat: number) => number) => World3dPlugin;

export type World3dOptions = {
  plugins?: World3dPluginFactory[];
};

export class World3dController {
  private map: MapLibreMap | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private dem: DemCache | null = null;
  private osm: OsmTileStream | null = null;
  private details: DetailLod | null = null;
  private plugins: World3dPlugin[] = [];
  private moveTimer: ReturnType<typeof setTimeout> | null = null;
  private syncing = false;
  private syncAgain = false;
  private added = false;
  private moveBound = false;
  private worldOrigin: WorldOrigin | null = null;
  private terrainGen = 0;
  private lastTraffic = 0;
  private repaintTimer: ReturnType<typeof setTimeout> | null = null;
  private visibleBound = false;
  private readonly mercatorM = new THREE.Matrix4();
  private readonly translateM = new THREE.Matrix4();
  private readonly scaleM = new THREE.Matrix4();
  /** Parent of all scene groups. Meshes store absolute meters above sea level. */
  private ground: THREE.Group | null = null;
  /** Mesh coordinates stay in this frame. Recentering every grid step used to wipe the scene. */
  private heldOrigin: WorldOrigin | null = null;
  enabled = false;

  constructor(private readonly options: World3dOptions = {}) {}

  /**
   * MapLibre 5: `queryTerrainElevation` returns meters above sea level (already exaggerated), and the
   * projection matrix of a custom layer is also sea-level based (verified: the screen center projects to
   * NDC 0 at `map.transform.elevation`, not at 0 m). Meshes therefore store absolute meters with no
   * camera-dependent offset. The 4.x code added the screen-center elevation when building and subtracted
   * the live value when drawing; in 5 that made trees and fences float or sink as the camera moved.
   */
  private sampleAlt = (lng: number, lat: number): number => {
    const map = this.map;
    if (map) {
      try {
        const elevation = map.queryTerrainElevation({ lng, lat });
        if (typeof elevation === 'number' && Number.isFinite(elevation)) return elevation;
      } catch {
        /* terrain not ready */
      }
    }
    const raw = this.dem?.sample(lng, lat);
    if (raw != null && Number.isFinite(raw)) return raw * terrainExaggeration();
    return Number.NaN;
  };

  private customLayer: CustomLayerInterface = {
    id: WORLD3D_LAYER_ID,
    type: 'custom',
    renderingMode: '3d',
    onAdd: (map, gl) => {
      this.map = map;
      this.camera = new THREE.Camera();
      this.scene = new THREE.Scene();
      this.renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      this.renderer.autoClear = false;
      this.renderer.autoClearColor = false;
      this.renderer.autoClearDepth = false;
      this.renderer.autoClearStencil = false;
      const ambient = new THREE.AmbientLight(0xdde8f2, 0.55);
      const sun = new THREE.DirectionalLight(0xfff1d0, 1.35);
      sun.position.set(80, 40, 120);
      this.ground = new THREE.Group();
      this.scene.add(ambient, sun, this.ground);
      this.dem = new DemCache();
      this.osm = new OsmTileStream(this.sampleAlt, () => this.map?.triggerRepaint());
      this.details = new DetailLod(this.sampleAlt, () => this.map?.triggerRepaint());
      this.plugins = (this.options.plugins ?? []).map((make) => make(this.sampleAlt));
      this.ground.add(this.osm.group, this.details.group, ...this.plugins.map((plugin) => plugin.group));
      void this.syncViewport();
    },
    render: (_gl, arg) => {
      if (!this.renderer || !this.scene || !this.camera || !this.map) return;
      const origin = this.worldOrigin;
      if (!origin) return;
      // The scene lives in local mercator meters, so it is only valid once the globe has fully flattened.
      const projection = arg.defaultProjectionData;
      if (projection.projectionTransition > 0) return;
      const matrix = projection.mainMatrix;
      if (this.map.getZoom() < WORLD3D_MIN_ZOOM) return;
      const mc = maplibregl.MercatorCoordinate.fromLngLat({ lon: origin.lng, lat: origin.lat }, origin.alt);
      const ppm = mc.meterInMercatorCoordinateUnits();
      this.mercatorM.fromArray(Array.from(matrix));
      this.translateM.makeTranslation(mc.x, mc.y, mc.z);
      this.scaleM.makeScale(ppm, -ppm, ppm);
      if (this.osm && this.trafficActive()) {
        const now = performance.now();
        const dt = this.lastTraffic ? Math.min(0.08, (now - this.lastTraffic) / 1000) : 0;
        this.lastTraffic = now;
        this.osm.tick(dt);
        if (this.osm.hasMotion()) this.kickMotion();
      } else {
        this.lastTraffic = 0;
      }
      this.camera.projectionMatrix.copy(this.mercatorM).multiply(this.translateM).multiply(this.scaleM);
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
    },
    onRemove: () => {
      this.added = false;
      this.disposeScene();
    },
  };

  attach(map: MapLibreMap): void {
    this.setEnabled(map, true);
  }

  setEnabled(map: MapLibreMap, enabled: boolean): void {
    this.map = map;
    this.enabled = enabled;
    if (enabled) {
      this.ensureLayer();
      try {
        ensureWorld3dStyleLayers(map);
        setWorld3dStyleVisible(map, true);
      } catch (err) {
        console.error('3D-Welt-Style:', err);
      }
      if (map.getZoom() >= WORLD3D_MIN_ZOOM && map.getPitch() < 30) map.easeTo({ pitch: 55, duration: 600 });
      if (!this.moveBound) {
        map.on('moveend', this.onMove);
        map.on('terrain', this.onMove);
        this.moveBound = true;
      }
      if (!this.visibleBound) {
        document.addEventListener('visibilitychange', this.onVisible);
        this.visibleBound = true;
      }
      void this.syncViewport();
    } else {
      map.off('moveend', this.onMove);
      map.off('terrain', this.onMove);
      this.moveBound = false;
      this.stopMotion();
      if (this.visibleBound) {
        document.removeEventListener('visibilitychange', this.onVisible);
        this.visibleBound = false;
      }
      try {
        setWorld3dStyleVisible(map, false);
      } catch {
        /* layers may be gone */
      }
      this.removeLayer();
    }
  }

  /** Rebuilds the view now, e.g. after a plugin changed its options. */
  refresh(): void {
    void this.syncViewport();
  }

  private ensureLayer(): void {
    const map = this.map;
    if (!map) return;
    // A style swap can drop the custom layer, so trust the map, not the flag.
    if (map.getLayer(WORLD3D_LAYER_ID)) {
      this.added = true;
      return;
    }
    map.addLayer(this.customLayer);
    this.added = true;
    try {
      raiseWorld3dStyleLayers(map);
    } catch {
      /* style layers optional */
    }
  }

  private removeLayer(): void {
    const map = this.map;
    if (!map || !this.added) return;
    if (map.getLayer(WORLD3D_LAYER_ID)) map.removeLayer(WORLD3D_LAYER_ID);
    this.added = false;
  }

  private onMove = (): void => {
    if (this.moveTimer) clearTimeout(this.moveTimer);
    if ((this.map?.getZoom() ?? 0) < WORLD3D_MIN_ZOOM) return;
    this.moveTimer = setTimeout(() => void this.syncViewport(), 280);
  };

  private onVisible = (): void => {
    if (!document.hidden) this.map?.triggerRepaint();
  };

  private trafficActive(): boolean {
    return world3dTrafficEnabled() && (this.map?.getZoom() ?? 0) >= WORLD3D_TRAFFIC_MIN_ZOOM && !document.hidden;
  }

  /** MapLibre stops drawing when the camera is idle. Traffic still needs frames, but not at 60 fps. */
  private kickMotion(): void {
    if (this.repaintTimer != null || document.hidden) return;
    this.repaintTimer = setTimeout(() => {
      this.repaintTimer = null;
      this.map?.triggerRepaint();
    }, WORLD3D_TRAFFIC_FRAME_MS);
  }

  private stopMotion(): void {
    if (this.repaintTimer == null) return;
    clearTimeout(this.repaintTimer);
    this.repaintTimer = null;
  }

  private async syncViewport(): Promise<void> {
    const map = this.map;
    if (!map || !this.enabled) return;
    if (this.syncing) {
      this.syncAgain = true;
      return;
    }
    if (!this.dem || !this.osm || !this.details) return;
    if (map.getZoom() < WORLD3D_MIN_ZOOM) return;
    this.syncing = true;
    try {
      const zoom = map.getZoom();
      const c = map.getCenter();
      const box = focusBbox(c.lng, c.lat, zoom);
      await this.dem.sync(box.west, box.south, box.east, box.north);
      const world = this.originFor(c.lng, c.lat);
      this.worldOrigin = world;
      const centerElev = this.sampleAlt(c.lng, c.lat);
      if (Number.isFinite(centerElev) && this.terrainGen === 0) this.terrainGen = 1;
      await this.osm.sync(box.west, box.south, box.east, box.north, zoom, world, this.terrainGen);
      this.details.schedule(box.west, box.south, box.east, box.north, zoom, world);
      const view: World3dView = { west: box.west, south: box.south, east: box.east, north: box.north, zoom, world };
      for (const plugin of this.plugins) await plugin.sync(view);
      map.triggerRepaint();
    } finally {
      this.syncing = false;
      if (this.syncAgain) {
        this.syncAgain = false;
        void this.syncViewport();
      }
    }
  }

  /**
   * Keep one origin while the camera stays nearby. A grid step used to dispose every
   * tree, vehicle and cable, then fetch them again — that was the pan flicker.
   * Past a few kilometres, slide existing objects into the new frame instead of rebuilding.
   */
  private originFor(lng: number, lat: number): WorldOrigin {
    const snapped = stickyWorldOrigin(lng, lat, 0);
    if (!this.heldOrigin) {
      this.heldOrigin = snapped;
      this.details?.useOrigin(snapped);
      return snapped;
    }
    const drift = enu(this.heldOrigin, lng, lat, 0);
    if (Math.hypot(drift.x, drift.y) < 6000) return this.heldOrigin;
    const shift = enu(this.heldOrigin, snapped.lng, snapped.lat, 0);
    this.slideChildren(this.osm?.group ?? null, shift);
    this.slideChildren(this.details?.group ?? null, shift);
    for (const plugin of this.plugins) this.slideChildren(plugin.group, shift);
    this.heldOrigin = snapped;
    this.details?.useOrigin(snapped);
    for (const plugin of this.plugins) plugin.discardInflight?.();
    return snapped;
  }

  private slideChildren(group: THREE.Group | null, shift: THREE.Vector3): void {
    if (!group) return;
    for (const child of group.children) {
      child.position.x -= shift.x;
      child.position.y -= shift.y;
      child.position.z -= shift.z;
    }
  }

  private disposeScene(): void {
    this.dem?.dispose();
    this.osm?.dispose();
    this.details?.dispose();
    for (const plugin of this.plugins) plugin.dispose();
    this.plugins = [];
    this.dem = null;
    this.osm = null;
    this.details = null;
    this.ground = null;
    this.heldOrigin = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
  }

  dispose(map: MapLibreMap): void {
    map.off('moveend', this.onMove);
    map.off('terrain', this.onMove);
    this.moveBound = false;
    this.stopMotion();
    if (this.visibleBound) {
      document.removeEventListener('visibilitychange', this.onVisible);
      this.visibleBound = false;
    }
    if (this.moveTimer) clearTimeout(this.moveTimer);
    this.removeLayer();
    this.disposeScene();
  }
}

