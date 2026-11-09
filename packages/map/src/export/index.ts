import { toGeoJson } from './geojson.js';
import { toGpx } from './gpx.js';
import { toKml } from './kml.js';
import type { VeitExportDocument, VeitExportFormat } from './types.js';

export { toGeoJson } from './geojson.js';
export { toGpx } from './gpx.js';
export { toKml } from './kml.js';
export type { VeitExportDocument, VeitExportFeature, VeitExportFormat, VeitExportPoint } from './types.js';

export type VeitExportFormatInfo = {
  format: VeitExportFormat;
  /** Anzeigename; Formatnamen werden nicht übersetzt. */
  label: string;
  extension: string;
  mime: string;
};

/** Die unterstützten Formate in empfohlener Reihenfolge. */
export const VEIT_EXPORT_FORMATS: readonly VeitExportFormatInfo[] = [
  { format: 'kml', label: 'KML', extension: 'kml', mime: 'application/vnd.google-earth.kml+xml' },
  { format: 'gpx', label: 'GPX', extension: 'gpx', mime: 'application/gpx+xml' },
  { format: 'geojson', label: 'GeoJSON', extension: 'geojson', mime: 'application/geo+json' },
];

export function exportFormatInfo(format: VeitExportFormat): VeitExportFormatInfo {
  const info = VEIT_EXPORT_FORMATS.find((f) => f.format === format);
  if (!info) throw new Error(`unknown export format ${format}`);
  return info;
}

/** Das Dokument im gewünschten Format als Text. */
export function exportDocument(doc: VeitExportDocument, format: VeitExportFormat): string {
  switch (format) {
    case 'kml':
      return toKml(doc);
    case 'gpx':
      return toGpx(doc);
    case 'geojson':
      return toGeoJson(doc);
  }
}

/** Dateiname aus einem freien Titel: Umlaute und Sonderzeichen ersetzt, mit Endung. */
export function exportFileName(title: string, format: VeitExportFormat): string {
  const base =
    title
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'export';
  return `${base}.${exportFormatInfo(format).extension}`;
}

/** Erzeugt die Datei und lädt sie im Browser herunter. */
export function downloadExport(doc: VeitExportDocument, format: VeitExportFormat, fileTitle = doc.name): void {
  const info = exportFormatInfo(format);
  const blob = new Blob([exportDocument(doc, format)], { type: `${info.mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName(fileTitle, format);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
