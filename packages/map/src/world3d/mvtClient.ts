import { parseOsmTileBuffer, type ParsedOsmTile, type ParseOptions } from './mvt.js';
import type { TileId } from './tileMath.js';

/** The scene only needs roads and woods. Buildings and water are drawn by MapLibre. */
export const SCENE_PARSE_OPTIONS: ParseOptions = {
  buildings: false,
  grasses: false,
  waters: false,
  waterways: false,
};

type Pending = { resolve: (parsed: ParsedOsmTile) => void; reject: (err: Error) => void };
type ResponseMsg =
  | { id: number; ok: true; parsed: ParsedOsmTile }
  | { id: number; ok: false; error: string };

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const pending = new Map<number, Pending>();

function ensureWorker(): Worker | null {
  if (workerBroken) return null;
  if (worker) return worker;
  try {
    const w = new Worker(new URL('./mvtWorker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (ev: MessageEvent<ResponseMsg>) => {
      const msg = ev.data;
      const job = pending.get(msg.id);
      if (!job) return;
      pending.delete(msg.id);
      if (msg.ok) job.resolve(msg.parsed);
      else job.reject(new Error(msg.error));
    };
    w.onerror = () => {
      workerBroken = true;
      worker = null;
      for (const job of pending.values()) job.reject(new Error('mvt worker failed'));
      pending.clear();
    };
    worker = w;
    return w;
  } catch {
    workerBroken = true;
    return null;
  }
}

/** Parse in a worker; fall back to the main thread when workers are unavailable. */
export function parseOsmTileOffThread(tile: TileId, buffer: ArrayBuffer): Promise<ParsedOsmTile> {
  const w = ensureWorker();
  if (!w) return Promise.resolve(parseOsmTileBuffer(tile, new Uint8Array(buffer), SCENE_PARSE_OPTIONS));
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    w.postMessage({ id, tile, buffer, opts: SCENE_PARSE_OPTIONS }, [buffer]);
  });
}
