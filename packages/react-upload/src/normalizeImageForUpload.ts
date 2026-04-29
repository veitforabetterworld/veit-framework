/**
 * Liefert true für JPEG: per MIME **oder** Magic Bytes (FF D8 FF).
 * Viele Browser/OS liefern bei Dateiauswahl `type: ""` – dann greift die Signatur.
 */
async function looksLikeJpegFile(file: File): Promise<boolean> {
  const t = (file.type || '').toLowerCase();
  if (t === 'image/jpeg' || t === 'image/jpg' || t === 'image/pjpeg') return true;
  const head = await file.slice(0, 3).arrayBuffer();
  if (head.byteLength < 3) return false;
  const v = new DataView(head);
  return v.getUint8(0) === 0xff && v.getUint8(1) === 0xd8 && v.getUint8(2) === 0xff;
}

const TAG_ORIENTATION = 0x0112;
const TAG_EXIF_IFD_POINTER = 0x8769;

function readOrientationFromTiffIfd(
  view: DataView,
  tiff: number,
  ifdOffset: number,
  little: boolean,
  depth: number
): number | null {
  if (depth > 4) return null;
  if (ifdOffset + 2 > view.byteLength || ifdOffset < 0) return null;
  const ifdStart = tiff + ifdOffset;
  if (ifdStart + 2 > view.byteLength) return null;
  const entries = view.getUint16(ifdStart, little);
  let p = ifdStart + 2;
  let exifSubIfd: number | null = null;

  for (let i = 0; i < entries; i++) {
    const entry = p + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, little);
    if (tag === TAG_ORIENTATION) {
      const val = view.getUint16(entry + 8, little);
      return val >= 1 && val <= 8 ? val : 1;
    }
    if (tag === TAG_EXIF_IFD_POINTER) {
      const type = view.getUint16(entry + 2, little);
      const count = view.getUint32(entry + 4, little);
      const val = view.getUint32(entry + 8, little);
      if (type === 4 && count === 1) exifSubIfd = val;
    }
  }

  if (exifSubIfd != null) {
    return readOrientationFromTiffIfd(view, tiff, exifSubIfd, little, depth + 1);
  }
  return null;
}

function parseExifOrientationFromApp1(
  view: DataView,
  dataStart: number,
  segmentDataLen: number
): number | null {
  if (segmentDataLen < 14 || dataStart + 14 > view.byteLength) return null;
  if (view.getUint32(dataStart, false) !== 0x45786966) return null;
  if (view.getUint16(dataStart + 4, false) !== 0) return null;

  const tiff = dataStart + 6;
  if (tiff + 8 > view.byteLength) return null;
  const little = view.getUint16(tiff, false) === 0x4949;
  const firstIfd = view.getUint32(tiff + 4, little);
  return readOrientationFromTiffIfd(view, tiff, firstIfd, little, 0);
}

function readOrientationFromJpeg(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  if (view.getUint16(0, false) !== 0xffd8) return 1;
  let offset = 2;
  const length = view.byteLength;
  while (offset + 4 <= length) {
    const marker = view.getUint16(offset, false);
    offset += 2;
    const size = view.getUint16(offset, false);
    if (size < 2) break;

    if (marker === 0xffe1) {
      const dataLen = size - 2;
      const dataStart = offset + 2;
      if (dataStart + dataLen <= length) {
        const o = parseExifOrientationFromApp1(view, dataStart, dataLen);
        if (o != null && o >= 1 && o <= 8) return o;
      }
    }

    if ((marker & 0xff00) !== 0xff00) break;
    offset += size;
  }
  return 1;
}

function applyOrientationTransform(
  ctx: CanvasRenderingContext2D,
  orientation: number,
  width: number,
  height: number
) {
  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, width, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, width, height);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, height);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, height, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, height, width);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, width);
      break;
    default:
      break;
  }
}

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

type DecodedCanvasSource = {
  src: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
};

async function decodeImageForResize(file: File): Promise<DecodedCanvasSource> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return {
      src: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => {
        try {
          bitmap.close();
        } catch {
          /* ignore */
        }
      },
    };
  } catch {
    const img = await loadImageElement(file);
    return {
      src: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      cleanup: () => {},
    };
  }
}

function extensionForMime(mime: string): string {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  return '.jpg';
}

function replaceExtension(filename: string, ext: string): string {
  const base = filename.replace(/\.[a-z0-9]+$/i, '');
  return `${base}${ext}`;
}

async function downscaleImageForStorage(file: File): Promise<File> {
  const type = (file.type || '').toLowerCase();
  if (!type.startsWith('image/')) return file;
  if (type === 'image/gif' || type === 'image/svg+xml') return file;

  const MAX_SIDE = 800;
  const MAX_BYTES_KEEP = 450_000;

  const { src, width, height, cleanup } = await decodeImageForResize(file);
  try {
    const longest = Math.max(width, height);
    const scale = longest > MAX_SIDE ? MAX_SIDE / longest : 1;
    const outW = Math.max(1, Math.round(width * scale));
    const outH = Math.max(1, Math.round(height * scale));
    const shouldResizeByDimensions = outW !== width || outH !== height;
    const shouldRecompress = !shouldResizeByDimensions && file.size > MAX_BYTES_KEEP && (type === 'image/jpeg' || type === 'image/webp');
    if (!shouldResizeByDimensions && !shouldRecompress) return file;

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(src, 0, 0, outW, outH);

    const outputMime = type === 'image/png' || type === 'image/webp' || type === 'image/jpeg' ? type : 'image/jpeg';
    const quality = outputMime === 'image/jpeg' || outputMime === 'image/webp' ? 0.68 : undefined;
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), outputMime, quality);
    });
    return new File([blob], replaceExtension(file.name, extensionForMime(outputMime)), { type: outputMime });
  } catch {
    return file;
  } finally {
    cleanup();
  }
}

/**
 * JPEG neu encodieren: EXIF-Orientierung vom Browser anwenden (wie Vorschau),
 * Ausgabe ohne EXIF-Drehung. Wichtig für **Kamera-Aufnahmen** auf Mobilgeräten,
 * wo manuelles EXIF + `imageOrientation: 'none'` je nach OS inkonsistent ist.
 */
async function reencodeJpegUsingBrowserOrientation(file: File): Promise<File | null> {
  let bitmap: ImageBitmap | null = null;
  try {
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.92);
    });
    return new File([blob], file.name.replace(/\.(jpe?g)$/i, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return null;
  } finally {
    if (bitmap) {
      try {
        bitmap.close();
      } catch {
        /* ignore */
      }
    }
  }
}

type DecodedSource = { src: CanvasImageSource; width: number; height: number; cleanup: () => void };

async function decodeImageRawForOrientation(file: File): Promise<DecodedSource> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'none' });
    return {
      src: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => {
        try {
          bitmap.close();
        } catch {
          /* ignore */
        }
      },
    };
  } catch {
    const img = await loadImageElement(file);
    return {
      src: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      cleanup: () => {},
    };
  }
}

/** Fallback: EXIF per Hand, wenn `from-image` nicht verfügbar ist. */
async function fallbackManualOrientation(file: File, orientation: number): Promise<File> {
  if (orientation === 1) return file;
  const { src, width, height, cleanup } = await decodeImageRawForOrientation(file);
  try {
    const swap = orientation >= 5 && orientation <= 8;
    const outW = swap ? height : width;
    const outH = swap ? width : height;
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    applyOrientationTransform(ctx, orientation, width, height);
    ctx.drawImage(src, 0, 0);

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.92);
    });
    return new File([blob], file.name.replace(/\.(jpe?g)$/i, '.jpg'), { type: 'image/jpeg' });
  } finally {
    cleanup();
  }
}

/**
 * Einheitliche Vorverarbeitung für Bild-Uploads.
 * Primär: Browser wendet EXIF wie bei der Anzeige an (`from-image`) → flaches JPEG.
 * Fallback: manuelle EXIF-Matrix (ältere Browser / seltene Formate).
 *
 * Kamera-Frames aus Canvas/Video (Map) brauchen das nicht – dort keine EXIF-Datei.
 */
export async function normalizeImageForUpload(file: File): Promise<File> {
  let normalized = file;
  if (await looksLikeJpegFile(file)) {
    try {
      const fromImage = await reencodeJpegUsingBrowserOrientation(file);
      if (fromImage) normalized = fromImage;
      else {
        const buffer = await file.arrayBuffer();
        const orientation = readOrientationFromJpeg(buffer);
        normalized = await fallbackManualOrientation(file, orientation);
      }
    } catch {
      normalized = file;
    }
  }
  return downscaleImageForStorage(normalized);
}
