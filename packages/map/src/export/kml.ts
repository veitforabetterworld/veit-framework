import { closeRing, escapeXml, hasAlt, hex6, isoTime, num } from './common.js';
import type { VeitExportDocument, VeitExportFeature, VeitExportPoint } from './types.js';

const KML_NS = 'http://www.opengis.net/kml/2.2';

/** KML-Farbe aabbggrr aus #rrggbb. */
function kmlColor(color: string | undefined, alpha = 'ff'): string {
  const h = hex6(color);
  return `${alpha}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`;
}

function coord(p: VeitExportPoint): string {
  return `${num(p.lon)},${num(p.lat)},${hasAlt(p) ? num(p.alt, 1) : 0}`;
}

function coordinates(points: VeitExportPoint[], indent: string): string {
  return `<coordinates>\n${points.map((p) => `${indent}  ${coord(p)}`).join('\n')}\n${indent}</coordinates>`;
}

function altitudeMode(points: VeitExportPoint[]): string {
  return points.length > 0 && points.every(hasAlt) ? '<altitudeMode>absolute</altitudeMode>' : '';
}

function textElement(tag: string, value: string | undefined): string {
  const v = (value ?? '').trim();
  if (!v) return '';
  return `<${tag}>${escapeXml(v)}</${tag}>`;
}

function extendedData(properties: VeitExportFeature['properties']): string {
  const entries = Object.entries(properties ?? {});
  if (entries.length === 0) return '';
  const data = entries
    .map(([key, value]) => `<Data name="${escapeXml(key)}"><value>${escapeXml(String(value))}</value></Data>`)
    .join('');
  return `<ExtendedData>${data}</ExtendedData>`;
}

type Styles = Map<string, string>;
type PointIcon = VeitExportDocument['kmlPointIcon'];

const DEFAULT_LINE_WIDTH = 3;
const DEFAULT_FILL_OPACITY = 0.4;

/** Deckkraft 0..1 als zweistelliges KML-Alpha. */
function alphaHex(opacity: number): string {
  const a = Math.round(Math.min(1, Math.max(0, opacity)) * 255);
  return a.toString(16).padStart(2, '0');
}

/** Stil-ID für Farbe, Linienbreite und Deckkraft; legt den Stil (Punkt, Linie, Fläche) beim ersten Mal an. */
function styleFor(styles: Styles, f: VeitExportFeature, icon: PointIcon): string {
  const width = f.lineWidth !== undefined && f.lineWidth > 0 ? f.lineWidth : DEFAULT_LINE_WIDTH;
  const alpha = alphaHex(f.fillOpacity ?? DEFAULT_FILL_OPACITY);
  const id = `veit_${hex6(f.color)}_${Math.round(width * 100)}_${alpha}`;
  if (!styles.has(id)) {
    const iconXml = icon
      ? `<scale>${num(icon.scale ?? 1, 2)}</scale><Icon><href>${escapeXml(icon.href)}</href></Icon>` +
        '<hotSpot x="0.5" xunits="fraction" y="0.5" yunits="fraction"/>'
      : '';
    styles.set(
      id,
      `    <Style id="${id}">
      <IconStyle><color>${kmlColor(f.color)}</color>${iconXml}</IconStyle>
      <LineStyle><color>${kmlColor(f.color)}</color><width>${num(width, 2)}</width></LineStyle>
      <PolyStyle><color>${kmlColor(f.color, alpha)}</color></PolyStyle>
    </Style>`,
    );
  }
  return id;
}

function placemark(f: VeitExportFeature, style: string, geometry: string, extra = ''): string {
  return `      <Placemark>
        ${textElement('name', f.name)}${textElement('description', f.description)}
        <styleUrl>#${style}</styleUrl>${extra}${extendedData(f.properties)}
        ${geometry}
      </Placemark>`;
}

function featureToKml(f: VeitExportFeature, styles: Styles, icon: PointIcon): string {
  const style = styleFor(styles, f, icon);
  switch (f.kind) {
    case 'point': {
      const when = isoTime(f.point.time);
      const stamp = when ? `<TimeStamp><when>${when}</when></TimeStamp>` : '';
      return placemark(f, style, `<Point>${altitudeMode([f.point])}<coordinates>${coord(f.point)}</coordinates></Point>`, stamp);
    }
    case 'line':
      if (f.points.length < 2) return '';
      return placemark(
        f,
        style,
        `<LineString><tessellate>1</tessellate>${altitudeMode(f.points)}${coordinates(f.points, '          ')}</LineString>`,
      );
    case 'polygon': {
      const ring = closeRing(f.ring);
      if (ring.length < 4) return '';
      return placemark(
        f,
        style,
        `<Polygon>${altitudeMode(ring)}<outerBoundaryIs><LinearRing><tessellate>1</tessellate>${coordinates(ring, '          ')}</LinearRing></outerBoundaryIs></Polygon>`,
      );
    }
    case 'track': {
      // Für möglichst viele Programme: der Weg als Linie (je Segment) und jeder Punkt mit Zeitstempel. Google Earth
      // zeigt damit einen Zeitschieber, Programme ohne Zeitbezug zeigen Linie und Punkte.
      const segments = f.segments.filter((s) => s.length > 0);
      const lines = segments
        .filter((s) => s.length >= 2)
        .map(
          (s) =>
            `<LineString><tessellate>1</tessellate>${altitudeMode(s)}${coordinates(s, '            ')}</LineString>`,
        );
      const path = lines.length === 0 ? '' : placemark(f, style, lines.length === 1 ? lines[0] : `<MultiGeometry>${lines.join('')}</MultiGeometry>`);
      const points = segments.flat().map((p) => {
        const when = isoTime(p.time);
        return `        <Placemark>
          ${when ? `<name>${when}</name><TimeStamp><when>${when}</when></TimeStamp>` : ''}
          <styleUrl>#${style}</styleUrl>
          <Point>${altitudeMode([p])}<coordinates>${coord(p)}</coordinates></Point>
        </Placemark>`;
      });
      if (!path && points.length === 0) return '';
      return `      <Folder>
        ${textElement('name', f.name)}
${path}
${points.join('\n')}
      </Folder>`;
    }
  }
}

/** KML 2.2: ein Placemark je Merkmal, gruppiert in Ordner nach `folder`. */
export function toKml(doc: VeitExportDocument): string {
  const styles: Styles = new Map();
  const loose: string[] = [];
  const folders = new Map<string, string[]>();
  for (const f of doc.features) {
    const xml = featureToKml(f, styles, doc.kmlPointIcon);
    if (!xml) continue;
    if (f.folder) {
      const list = folders.get(f.folder) ?? [];
      list.push(xml);
      folders.set(f.folder, list);
    } else {
      loose.push(xml);
    }
  }
  const folderXml = [...folders.entries()].map(
    ([name, items]) => `    <Folder>
      <name>${escapeXml(name)}</name>
${items.join('\n')}
    </Folder>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="${KML_NS}">
  <Document>
    <name>${escapeXml(doc.name)}</name>${doc.description ? `\n    ${textElement('description', doc.description)}` : ''}
${[...styles.values()].join('\n')}
${[...loose, ...folderXml].join('\n')}
  </Document>
</kml>
`;
}
