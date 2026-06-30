import { existsSync } from 'node:fs';
import path from 'node:path';
import type { WorkerOptions } from 'tesseract.js';

/** OCR-Sprachen (Deutsch + Englisch). */
export const DEFAULT_TESSERACT_LANGS = 'deu+eng';

const TESSDATA_LANGS = ['deu', 'eng'] as const;

export type TessdataOptions = {
  /** Explizites tessdata-Verzeichnis (mit oder ohne trailing separator). */
  tessdataDir?: string;
  /** Fallback: `<packageRoot>/tessdata` wenn kein explizites Verzeichnis gesetzt ist. */
  packageRoot?: string;
};

function normalizeDir(dir: string): string {
  return dir.endsWith(path.sep) ? dir : `${dir}${path.sep}`;
}

/** Verzeichnis mit *.traineddata; Tesseract erwartet trailing separator. */
export function resolveTessdataDir(options?: TessdataOptions): string {
  const fromEnv = process.env.PLENIVO_TESSDATA_DIR?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return normalizeDir(fromEnv);
  }
  if (options?.tessdataDir?.trim()) {
    return normalizeDir(options.tessdataDir.trim());
  }
  if (options?.packageRoot?.trim()) {
    return normalizeDir(path.join(options.packageRoot.trim(), 'tessdata'));
  }
  return normalizeDir(path.join(process.cwd(), 'tessdata'));
}

export function tessdataReady(options?: TessdataOptions): boolean {
  const dir = resolveTessdataDir(options);
  return TESSDATA_LANGS.every((lang) => existsSync(`${dir}${lang}.traineddata`));
}

/** Lokale *.traineddata (uncompressed); kein CDN-Zugriff zur Laufzeit. */
export function tesseractWorkerOptions(options?: TessdataOptions): Partial<WorkerOptions> {
  const langPath = resolveTessdataDir(options);
  return {
    langPath,
    cachePath: langPath,
    gzip: false,
    logger: () => {},
  };
}
