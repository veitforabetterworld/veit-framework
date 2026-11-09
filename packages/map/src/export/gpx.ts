import { closeRing, escapeXml, hasAlt, isoTime, num } from './common.js';
import type { VeitExportDocument, VeitExportFeature, VeitExportPoint } from './types.js';

const GPX_NS = 'http://www.topografix.com/GPX/1/1';

function pointBody(p: VeitExportPoint): string {
  const ele = hasAlt(p) ? `<ele>${num(p.alt, 1)}</ele>` : '';
  const when = isoTime(p.time);
  return `${ele}${when ? `<time>${when}</time>` : ''}`;
}

function describe(f: VeitExportFeature): string {
  const name = f.name?.trim() ? `<name>${escapeXml(f.name.trim())}</name>` : '';
  const desc = f.description?.trim() ? `<desc>${escapeXml(f.description.trim())}</desc>` : '';
  const type = f.folder ? `<type>${escapeXml(f.folder)}</type>` : '';
  return `${name}${desc}${type}`;
}

function trkpts(points: VeitExportPoint[]): string {
  return points.map((p) => `        <trkpt lat="${num(p.lat)}" lon="${num(p.lon)}">${pointBody(p)}</trkpt>`).join('\n');
}

function trk(f: VeitExportFeature, segments: VeitExportPoint[][]): string {
  const segs = segments.filter((s) => s.length > 0);
  if (segs.length === 0) return '';
  return `  <trk>${describe(f)}
${segs.map((s) => `    <trkseg>\n${trkpts(s)}\n    </trkseg>`).join('\n')}
  </trk>`;
}

/**
 * GPX 1.1: Punkte als Wegpunkte (wpt), Verläufe als Tracks mit Zeit und Höhe (trk), Linien und Flächen ebenfalls als
 * Track (ohne Zeit; Flächen als geschlossener Ring), wie es Navigations- und Sport-Apps erwarten.
 * Eigene Eigenschaften (properties) haben in GPX keinen Standardplatz und bleiben weg.
 */
export function toGpx(doc: VeitExportDocument): string {
  const wpts: string[] = [];
  const trks: string[] = [];
  for (const f of doc.features) {
    switch (f.kind) {
      case 'point':
        wpts.push(`  <wpt lat="${num(f.point.lat)}" lon="${num(f.point.lon)}">${pointBody(f.point)}${describe(f)}</wpt>`);
        break;
      case 'line':
        if (f.points.length >= 2) trks.push(trk(f, [f.points]));
        break;
      case 'polygon': {
        const ring = closeRing(f.ring);
        if (ring.length >= 4) trks.push(trk(f, [ring]));
        break;
      }
      case 'track':
        trks.push(trk(f, f.segments));
        break;
    }
  }
  const desc = doc.description?.trim() ? `<desc>${escapeXml(doc.description.trim())}</desc>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="${escapeXml(doc.creator ?? 'veit-framework')}" xmlns="${GPX_NS}">
  <metadata><name>${escapeXml(doc.name)}</name>${desc}</metadata>
${[...wpts, ...trks.filter(Boolean)].join('\n')}
</gpx>
`;
}
