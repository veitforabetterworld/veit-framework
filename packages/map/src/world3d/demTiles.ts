import { terrainTilesUrl } from '../terrain.js';
import { coveringTiles, tileKey, type TileId } from './tileMath.js';

const DEM_ZOOM = 12;
const GRID = 33;
const MAX_DEM_TILES = 16;

type DemTile = {
  key: string;
  heights: Float32Array;
};

function terrariumMeters(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

async function loadTerrarium(tile: TileId): Promise<Float32Array> {
  const tmpl = terrainTilesUrl();
  const url = tmpl.replace('{z}', String(tile.z)).replace('{x}', String(tile.x)).replace('{y}', String(tile.y));
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`DEM ${tileKey(tile)}`));
    el.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = GRID;
  canvas.height = GRID;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('dem canvas');
  ctx.drawImage(img, 0, 0, GRID, GRID);
  const pix = ctx.getImageData(0, 0, GRID, GRID).data;
  const heights = new Float32Array(GRID * GRID);
  for (let i = 0; i < GRID * GRID; i++) {
    heights[i] = terrariumMeters(pix[i * 4]!, pix[i * 4 + 1]!, pix[i * 4 + 2]!);
  }
  return heights;
}

export class DemCache {
  private tiles = new Map<string, DemTile>();
  private loading = new Set<string>();
  private heightsByKey = new Map<string, { tile: TileId; heights: Float32Array }>();

  sample(lng: number, lat: number): number | null {
    const n = 2 ** DEM_ZOOM;
    const x = Math.floor(((lng + 180) / 360) * n);
    const yFrac = 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI);
    const y = Math.floor(yFrac * n);
    const key = tileKey({ z: DEM_ZOOM, x, y });
    const rec = this.heightsByKey.get(key);
    if (!rec) return null;
    const u = ((lng + 180) / 360) * n - x;
    const v = yFrac * n - y;
    const col = Math.max(0, Math.min(GRID - 2, Math.floor(u * (GRID - 1))));
    const row = Math.max(0, Math.min(GRID - 2, Math.floor(v * (GRID - 1))));
    const fu = u * (GRID - 1) - col;
    const fv = v * (GRID - 1) - row;
    const h = rec.heights;
    const i = row * GRID + col;
    const a = h[i] ?? 0;
    const b = h[i + 1] ?? 0;
    const c = h[i + GRID] ?? 0;
    const d = h[i + GRID + 1] ?? 0;
    return a * (1 - fu) * (1 - fv) + b * fu * (1 - fv) + c * (1 - fu) * fv + d * fu * fv;
  }

  async sync(west: number, south: number, east: number, north: number): Promise<void> {
    const wanted = coveringTiles(west, south, east, north, DEM_ZOOM, MAX_DEM_TILES);
    const keep = new Set(wanted.map(tileKey));
    for (const [key] of this.tiles) {
      if (keep.has(key)) continue;
      this.tiles.delete(key);
      this.heightsByKey.delete(key);
    }
    await Promise.all(
      wanted.map(async (tile) => {
        const key = tileKey(tile);
        if (this.tiles.has(key) || this.loading.has(key)) return;
        this.loading.add(key);
        try {
          const heights = await loadTerrarium(tile);
          if (!keep.has(key)) return;
          this.tiles.set(key, { key, heights });
          this.heightsByKey.set(key, { tile, heights });
        } catch {
          /* DEM tile missing */
        } finally {
          this.loading.delete(key);
        }
      }),
    );
  }

  dispose(): void {
    this.tiles.clear();
    this.heightsByKey.clear();
  }
}
