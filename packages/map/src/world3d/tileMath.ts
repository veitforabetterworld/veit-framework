export type TileId = { z: number; x: number; y: number };

export function tileKey(tile: TileId): string {
  return `${tile.z}/${tile.x}/${tile.y}`;
}

export function lngToTileX(lng: number, z: number): number {
  return ((lng + 180) / 360) * 2 ** z;
}

export function latToTileY(lat: number, z: number): number {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z;
}

export function tileXToLng(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}

export function tileYToLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/** Cover a WGS84 bbox; drop zoom until the set fits `maxTiles` so we don't clip the NW corner. */
export function coveringTiles(
  west: number,
  south: number,
  east: number,
  north: number,
  z: number,
  maxTiles: number,
): TileId[] {
  let zoom = Math.max(0, Math.min(22, Math.floor(z)));
  for (; zoom >= 0; zoom--) {
    const n = 2 ** zoom;
    let x0 = Math.floor(lngToTileX(west, zoom));
    let x1 = Math.floor(lngToTileX(east, zoom));
    let y0 = Math.floor(latToTileY(north, zoom));
    let y1 = Math.floor(latToTileY(south, zoom));
    x0 = Math.max(0, Math.min(n - 1, x0));
    x1 = Math.max(0, Math.min(n - 1, x1));
    y0 = Math.max(0, Math.min(n - 1, y0));
    y1 = Math.max(0, Math.min(n - 1, y1));
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (y1 < y0) [y0, y1] = [y1, y0];
    const count = (x1 - x0 + 1) * (y1 - y0 + 1);
    if (count > maxTiles && zoom > 0) continue;
    const tiles: TileId[] = [];
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        tiles.push({ z: zoom, x, y });
        if (tiles.length >= maxTiles) return tiles;
      }
    }
    return tiles;
  }
  return [];
}

export function tileLngLat(tile: TileId, u: number, v: number): [number, number] {
  return [tileXToLng(tile.x + u, tile.z), tileYToLat(tile.y + v, tile.z)];
}

/**
 * Tight WGS84 window around the camera, not the pitched frustum.
 * Pitched MapLibre bounds stretch to the horizon and would pull continent-sized meshes.
 */
export function focusBbox(
  lng: number,
  lat: number,
  zoom: number,
): { west: number; south: number; east: number; north: number } {
  const spanDeg = Math.min(0.35, Math.max(0.0035, 0.18 * 2 ** (12 - zoom)));
  const cos = Math.max(0.25, Math.cos((lat * Math.PI) / 180));
  const lngSpan = spanDeg / cos;
  return {
    west: lng - lngSpan,
    south: lat - spanDeg,
    east: lng + lngSpan,
    north: lat + spanDeg,
  };
}
