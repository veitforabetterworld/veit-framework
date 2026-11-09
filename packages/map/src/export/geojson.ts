import { closeRing, hasAlt, isoTime } from './common.js';
import type { VeitExportDocument, VeitExportFeature, VeitExportPoint } from './types.js';

type Position = number[];

function position(p: VeitExportPoint): Position {
  return hasAlt(p) ? [p.lon, p.lat, p.alt] : [p.lon, p.lat];
}

function properties(f: VeitExportFeature): Record<string, unknown> {
  const props: Record<string, unknown> = { ...(f.properties ?? {}) };
  if (f.name) props.name = f.name;
  if (f.description) props.description = f.description;
  if (f.color) props.stroke = f.color;
  if (f.folder) props.folder = f.folder;
  return props;
}

function featureToGeoJson(f: VeitExportFeature): Record<string, unknown> | null {
  switch (f.kind) {
    case 'point': {
      const props = properties(f);
      const when = isoTime(f.point.time);
      if (when) props.time = when;
      return { type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: position(f.point) } };
    }
    case 'line':
      if (f.points.length < 2) return null;
      return { type: 'Feature', properties: properties(f), geometry: { type: 'LineString', coordinates: f.points.map(position) } };
    case 'polygon': {
      const ring = closeRing(f.ring);
      if (ring.length < 4) return null;
      return { type: 'Feature', properties: properties(f), geometry: { type: 'Polygon', coordinates: [ring.map(position)] } };
    }
    case 'track': {
      const segs = f.segments.filter((s) => s.length >= 2);
      if (segs.length === 0) return null;
      // Zeitstempel je Punkt wie bei togeojson/Mapbox üblich: properties.coordTimes (bei mehreren Segmenten je Segment).
      const times = segs.map((s) => s.map((p) => isoTime(p.time)));
      const props = properties(f);
      props.coordTimes = segs.length === 1 ? times[0] : times;
      const geometry =
        segs.length === 1
          ? { type: 'LineString', coordinates: segs[0].map(position) }
          : { type: 'MultiLineString', coordinates: segs.map((s) => s.map(position)) };
      return { type: 'Feature', properties: props, geometry };
    }
  }
}

/** GeoJSON (RFC 7946) als FeatureCollection; Name und Beschreibung des Dokuments als Fremdmitglieder. */
export function toGeoJson(doc: VeitExportDocument): string {
  const features = doc.features.map(featureToGeoJson).filter((f): f is Record<string, unknown> => f !== null);
  const collection: Record<string, unknown> = { type: 'FeatureCollection', name: doc.name };
  if (doc.description) collection.description = doc.description;
  collection.features = features;
  return `${JSON.stringify(collection, null, 2)}\n`;
}
