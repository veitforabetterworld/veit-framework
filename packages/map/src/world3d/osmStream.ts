import * as THREE from 'three';
import { fetchMvtBuffer, type LineFeature, type ParsedOsmTile } from './mvt.js';
import { parseOsmTileOffThread } from './mvtClient.js';
import {
  TILE_BUILD_STEPS,
  WoodScatterJob,
  addOsmTileStep,
  createOsmTileGroup,
  disposeGroup,
  paintLeafFromStands,
} from './osmTileScene.js';
import { buildRoadGroup, tickRoadRigs } from './roads.js';
import { fetchLeafStands, type LeafStand } from './overpass.js';
import { coveringTiles, tileKey, tileXToLng, tileYToLat, type TileId } from './tileMath.js';
import type { WorldOrigin } from './lngLat.js';

const MAX_OSM_TILES = 16;

function osmZoom(mapZoom: number): number {
  if (mapZoom < 13) return 12;
  if (mapZoom < 15) return 13;
  return 14;
}

type CacheEntry = {
  key: string;
  tile: TileId;
  parsed: ParsedOsmTile;
  group: THREE.Group | null;
  builtBand: number;
  lastSeen: number;
  /** Index of the next build step while a staged mount is in progress. */
  step: number;
  /** Resumable tree placement for the "trees" step. */
  scatter: WoodScatterJob | null;
};

function treeBand(zoom: number): number {
  return zoom >= 14 ? 1 : 0;
}

type MountJob = { rec: CacheEntry; epoch: number; zoom: number; world: WorldOrigin };

/** Gap between build ticks, so MapLibre can draw in between. */
const MOUNT_DELAY_MS = 16;
/** Main-thread time one tick may spend placing trees. */
const TREE_BUDGET_MS = 6;

export class OsmTileStream {
  readonly group = new THREE.Group();
  private cache = new Map<string, CacheEntry>();
  private loading = new Set<string>();
  private terrainKey = '';
  private wanted = new Set<string>();
  private epoch = 0;
  private viewZoom = 0;
  private viewWorld: WorldOrigin | null = null;
  private pendingMounts: MountJob[] = [];
  private drainScheduled = false;
  private trainGroup: THREE.Group | null = null;
  private trainKey = '';

  constructor(
    private sampleAlt: (lng: number, lat: number) => number,
    private onChange?: () => void,
  ) {}

  async sync(
    west: number,
    south: number,
    east: number,
    north: number,
    mapZoom: number,
    world: WorldOrigin,
    terrainGen = 0,
  ): Promise<void> {
    const terrainKey = String(terrainGen);
    if (terrainKey !== this.terrainKey) {
      this.clearCache();
      this.terrainKey = terrainKey;
    }
    this.viewZoom = mapZoom;
    this.viewWorld = world;
    await this.syncMvtFallback(west, south, east, north, mapZoom);
  }

  hasMotion(): boolean {
    const rigs = this.trainGroup?.userData.roadRigs as unknown[] | undefined;
    return Boolean(rigs && rigs.length > 0);
  }

  /** One build step per call. Returns true when the tile is finished. */
  private mountStep(rec: CacheEntry, mapZoom: number, world: WorldOrigin): boolean {
    const band = treeBand(mapZoom);
    if (rec.group && rec.builtBand === band && rec.step >= TILE_BUILD_STEPS.length) return true;
    if (!rec.group || rec.builtBand !== band) {
      if (rec.group) {
        this.group.remove(rec.group);
        disposeGroup(rec.group);
      }
      rec.group = createOsmTileGroup(rec.tile);
      rec.builtBand = band;
      rec.step = 0;
      rec.scatter = null;
      this.group.add(rec.group);
    }
    const step = TILE_BUILD_STEPS[rec.step];
    if (step === 'trees' && mapZoom >= 14) {
      const job = rec.scatter;
      if (!job || job.world.lng !== world.lng || job.world.lat !== world.lat) {
        rec.scatter = new WoodScatterJob(rec.parsed.woods, this.sampleAlt, world);
      }
      if (!rec.scatter!.run(TREE_BUDGET_MS)) return false;
      const trees = rec.scatter!.build();
      rec.scatter = null;
      if (trees) rec.group.add(trees);
    } else if (step) {
      addOsmTileStep(rec.group, step, rec.parsed, mapZoom, this.sampleAlt, world);
    }
    rec.step += 1;
    const done = rec.step >= TILE_BUILD_STEPS.length;
    if (done) this.syncTrains();
    return done;
  }

  private async syncMvtFallback(
    west: number,
    south: number,
    east: number,
    north: number,
    mapZoom: number,
  ): Promise<void> {
    const z = osmZoom(mapZoom);
    const wanted = coveringTiles(west, south, east, north, z, MAX_OSM_TILES);
    const keep = new Set(wanted.map(tileKey));
    this.wanted = keep;
    const now = performance.now();
    for (const rec of this.cache.values()) {
      if (keep.has(rec.key)) rec.lastSeen = now;
    }
    for (const [key, rec] of this.cache) {
      if (keep.has(key) || rec.tile.z === z) continue;
      if (rec.group) {
        this.group.remove(rec.group);
        disposeGroup(rec.group);
      }
      this.cache.delete(key);
    }
    if (this.cache.size > MAX_OSM_TILES) {
      const spare = [...this.cache.values()]
        .filter((rec) => !keep.has(rec.key))
        .sort((a, b) => a.lastSeen - b.lastSeen);
      while (this.cache.size > MAX_OSM_TILES && spare.length) {
        const rec = spare.shift()!;
        if (rec.group) {
          this.group.remove(rec.group);
          disposeGroup(rec.group);
        }
        this.cache.delete(rec.key);
      }
    }
    this.syncTrains();
    for (const rec of this.cache.values()) {
      if (!keep.has(rec.key)) continue;
      if (rec.group && rec.builtBand === treeBand(mapZoom) && rec.step >= TILE_BUILD_STEPS.length) continue;
      this.scheduleMount(rec);
    }
    await Promise.all(
      wanted.map(async (tile) => {
        const key = tileKey(tile);
        if (this.cache.has(key) || this.loading.has(key)) return;
        this.loading.add(key);
        const westT = tileXToLng(tile.x, tile.z);
        const eastT = tileXToLng(tile.x + 1, tile.z);
        const northT = tileYToLat(tile.y, tile.z);
        const southT = tileYToLat(tile.y + 1, tile.z);
        const standsPromise: Promise<LeafStand[]> = Promise.race([
          fetchLeafStands(westT, southT, eastT, northT),
          new Promise<LeafStand[]>((resolve) => setTimeout(() => resolve([]), 4000)),
        ]).catch(() => []);
        try {
          const buf = await fetchMvtBuffer(tile);
          const parsed = await parseOsmTileOffThread(tile, buf);
          if (!this.wanted.has(key) || this.cache.has(key)) return;
          const rec: CacheEntry = { key, tile, parsed, group: null, builtBand: -1, lastSeen: now, step: 0, scatter: null };
          this.cache.set(key, rec);
          void standsPromise.then((stands) => {
            const live = this.cache.get(key);
            if (!live || live !== rec || live.group || stands.length === 0) return;
            paintLeafFromStands(live.parsed.woods, stands);
          });
          this.scheduleMount(rec);
        } catch {
          /* tile missing */
        } finally {
          this.loading.delete(key);
        }
      }),
    );
  }

  private scheduleMount(rec: CacheEntry): void {
    const world = this.viewWorld;
    if (!world) return;
    this.pendingMounts.push({ rec, epoch: this.epoch, zoom: this.viewZoom, world });
    if (this.drainScheduled) return;
    this.drainScheduled = true;
    setTimeout(() => this.drainMount(), MOUNT_DELAY_MS);
  }

  private drainMount(): void {
    const job = this.pendingMounts.shift();
    if (!job) {
      this.drainScheduled = false;
      return;
    }
    const live = this.cache.get(job.rec.key);
    const world = this.viewWorld ?? job.world;
    if (job.epoch === this.epoch && live === job.rec && this.wanted.has(job.rec.key)) {
      const done = this.mountStep(job.rec, job.zoom, world);
      this.onChange?.();
      if (!done) this.pendingMounts.unshift(job);
    }
    if (this.pendingMounts.length) setTimeout(() => this.drainMount(), MOUNT_DELAY_MS);
    else this.drainScheduled = false;
  }

  tick(dt: number): void {
    if (dt <= 0 || !this.trainGroup) return;
    tickRoadRigs(this.trainGroup, dt);
  }

  /** One rail graph for every loaded tile, so a train crosses the tile cut instead of reversing. */
  private syncTrains(): void {
    const world = this.viewWorld;
    if (!world || this.viewZoom < 14) {
      this.clearTrains();
      return;
    }
    const keys = [...this.cache.keys()].filter((key) => this.wanted.has(key)).sort();
    const sig = `${world.lng.toFixed(5)},${world.lat.toFixed(5)}|${keys.join(',')}`;
    if (sig === this.trainKey) return;
    this.clearTrains();
    const roads: LineFeature[] = [];
    const buckets: string[] = [];
    for (const key of keys) {
      const roadsInTile = this.cache.get(key)?.parsed.roads;
      if (!roadsInTile) continue;
      for (const road of roadsInTile) {
        roads.push(road);
        buckets.push(key);
      }
    }
    const group = roads.length ? buildRoadGroup(roads, this.sampleAlt, world, buckets) : null;
    this.trainKey = sig;
    if (!group) return;
    this.trainGroup = group;
    this.group.add(group);
  }

  private clearTrains(): void {
    if (this.trainGroup) {
      this.group.remove(this.trainGroup);
      disposeGroup(this.trainGroup);
      this.trainGroup = null;
    }
    this.trainKey = '';
  }

  private clearCache(): void {
    this.epoch += 1;
    this.pendingMounts.length = 0;
    this.clearTrains();
    for (const rec of this.cache.values()) {
      if (!rec.group) continue;
      this.group.remove(rec.group);
      disposeGroup(rec.group);
    }
    this.cache.clear();
  }

  dispose(): void {
    this.clearCache();
    this.terrainKey = '';
  }
}
