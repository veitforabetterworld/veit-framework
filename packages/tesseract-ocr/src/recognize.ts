import Tesseract from 'tesseract.js';

import {
  DEFAULT_TESSERACT_LANGS,
  type TessdataOptions,
  tessdataReady,
  tesseractWorkerOptions,
} from './tessdata.js';

/** LSTM-only — Standard für Tesseract 4+ / tessdata 4.0.0. */
const TESSERACT_OEM = 1;

let sharedWorker: Promise<Tesseract.Worker> | null = null;
let sharedWorkerKey = '';

function workerCacheKey(options: TessdataOptions | undefined, langs: string): string {
  return `${langs}:${options?.tessdataDir ?? ''}:${options?.packageRoot ?? ''}`;
}

async function getOcrWorker(
  options: TessdataOptions | undefined,
  langs: string,
): Promise<Tesseract.Worker> {
  if (!tessdataReady(options)) {
    throw new Error(
      'Tesseract tessdata fehlt (deu/eng). Bitte pnpm --filter @plenivo/api prebuild auf dem API-Host ausführen.',
    );
  }
  const key = workerCacheKey(options, langs);
  if (!sharedWorker || sharedWorkerKey !== key) {
    sharedWorkerKey = key;
    sharedWorker = Tesseract.createWorker(langs, TESSERACT_OEM, tesseractWorkerOptions(options));
  }
  return sharedWorker;
}

/** Erkennt Text in einem Bild-Puffer (PNG, JPEG, …). */
export async function recognizeImageBuffer(
  buffer: Buffer,
  options?: TessdataOptions & { langs?: string },
): Promise<string> {
  const langs = options?.langs?.trim() || DEFAULT_TESSERACT_LANGS;
  const worker = await getOcrWorker(options, langs);
  const {
    data: { text },
  } = await worker.recognize(buffer);
  return (text ?? '').trim();
}
