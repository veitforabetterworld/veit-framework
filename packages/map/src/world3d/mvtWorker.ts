import { parseOsmTileBuffer, type ParsedOsmTile, type ParseOptions } from './mvt.js';
import type { TileId } from './tileMath.js';

type RequestMsg = { id: number; tile: TileId; buffer: ArrayBuffer; opts?: ParseOptions };
type ResponseMsg =
  | { id: number; ok: true; parsed: ParsedOsmTile }
  | { id: number; ok: false; error: string };

self.onmessage = (ev: MessageEvent<RequestMsg>) => {
  const { id, tile, buffer, opts } = ev.data;
  try {
    const parsed = parseOsmTileBuffer(tile, new Uint8Array(buffer), opts);
    const out: ResponseMsg = { id, ok: true, parsed };
    self.postMessage(out);
  } catch (err) {
    const out: ResponseMsg = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
    self.postMessage(out);
  }
};
