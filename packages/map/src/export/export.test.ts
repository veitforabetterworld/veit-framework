import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { exportDocument, exportFileName, toGeoJson, toGpx, toKml, type VeitExportDocument } from './index.js';

const doc: VeitExportDocument = {
  name: 'Fahrrad <Test> & Co',
  description: 'Verlauf',
  creator: 'tracker',
  features: [
    {
      kind: 'track',
      name: 'Fahrrad',
      color: '#e11d48',
      segments: [
        [
          { lat: 49.5672, lon: 10.8841, alt: 300, time: '2026-11-09T10:00:00.000Z' },
          { lat: 49.568, lon: 10.885, alt: 301.5, time: new Date('2026-11-09T10:15:00Z') },
        ],
        [{ lat: 49.57, lon: 10.89, time: '2026-11-09T12:00:00Z' }, { lat: 49.571, lon: 10.891 }],
      ],
    },
    { kind: 'point', name: 'Start', point: { lat: 49.5, lon: 10.8 }, properties: { counter: 7 }, folder: 'Ebene 1' },
    { kind: 'line', name: 'Weg', points: [{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }] },
    { kind: 'polygon', name: 'Fläche', ring: [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 1, lon: 1 }] },
  ],
};

/** Grobe Wohlgeformtheit: jedes geöffnete Element wird in richtiger Reihenfolge geschlossen. */
function assertBalanced(xml: string) {
  const stack: string[] = [];
  const body = xml.replace(/<\?xml[^>]*\?>/, '');
  for (const m of body.matchAll(/<(\/?)([A-Za-z][\w:]*)[^>]*?(\/?)>/g)) {
    const [, closing, tag, selfClosing] = m;
    if (selfClosing) continue;
    if (closing) assert.equal(stack.pop(), tag, `unerwartetes </${tag}>`);
    else stack.push(tag);
  }
  assert.deepEqual(stack, [], `nicht geschlossen: ${stack.join(', ')}`);
}

describe('toKml', () => {
  const kml = toKml(doc);
  it('is balanced and escapes text', () => {
    assertBalanced(kml);
    assert.match(kml, /<name>Fahrrad &lt;Test&gt; &amp; Co<\/name>/);
  });
  it('writes the track as line plus timestamped points', () => {
    assert.match(kml, /<MultiGeometry><LineString>/);
    assert.match(kml, /<when>2026-11-09T10:15:00Z<\/when>/);
    assert.match(kml, /10\.8841,49\.5672,300/);
    // KML-Farbe aabbggrr
    assert.match(kml, /<color>ff481de1<\/color>/);
  });
  it('groups by folder and keeps properties', () => {
    assert.match(kml, /<Folder>\s*<name>Ebene 1<\/name>/);
    assert.match(kml, /<Data name="counter"><value>7<\/value><\/Data>/);
  });
  it('closes polygon rings', () => {
    // KML: Länge vor Breite
    assert.match(kml, /<Polygon>.*0,0,0\n\s*1,0,0\n\s*1,1,0\n\s*0,0,0/s);
  });
});

describe('toGpx', () => {
  const gpx = toGpx(doc);
  it('is balanced GPX 1.1', () => {
    assertBalanced(gpx);
    assert.match(gpx, /<gpx version="1\.1" creator="tracker"/);
  });
  it('writes track segments with elevation and time', () => {
    assert.equal(gpx.match(/<trkseg>/g)?.length, 4);   // 2 Segmente + Linie + Fläche
    assert.match(gpx, /<trkpt lat="49\.568" lon="10\.885"><ele>301\.5<\/ele><time>2026-11-09T10:15:00Z<\/time><\/trkpt>/);
    assert.match(gpx, /<trkpt lat="49\.571" lon="10\.891"><\/trkpt>/);
  });
  it('writes points as waypoints', () => {
    assert.match(gpx, /<wpt lat="49\.5" lon="10\.8"><name>Start<\/name><type>Ebene 1<\/type><\/wpt>/);
  });
});

describe('toGeoJson', () => {
  const geo = JSON.parse(toGeoJson(doc)) as {
    type: string;
    name: string;
    features: Array<{ geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> }>;
  };
  it('is a FeatureCollection', () => {
    assert.equal(geo.type, 'FeatureCollection');
    assert.equal(geo.name, 'Fahrrad <Test> & Co');
    assert.equal(geo.features.length, 4);
  });
  it('writes the track as MultiLineString with coordTimes', () => {
    const track = geo.features[0];
    assert.equal(track.geometry.type, 'MultiLineString');
    assert.deepEqual((track.geometry.coordinates as number[][][])[0][0], [10.8841, 49.5672, 300]);
    assert.deepEqual(track.properties.coordTimes, [
      ['2026-11-09T10:00:00Z', '2026-11-09T10:15:00Z'],
      ['2026-11-09T12:00:00Z', null],
    ]);
    assert.equal(track.properties.stroke, '#e11d48');
  });
  it('closes polygons', () => {
    const ring = (geo.features[3].geometry.coordinates as number[][][])[0];
    assert.deepEqual(ring[0], ring[ring.length - 1]);
  });
});

describe('exportDocument / exportFileName', () => {
  it('picks the writer by format', () => {
    assert.ok(exportDocument(doc, 'kml').includes('<kml'));
    assert.ok(exportDocument(doc, 'gpx').includes('<gpx'));
    assert.ok(exportDocument(doc, 'geojson').startsWith('{'));
  });
  it('builds safe file names', () => {
    assert.equal(exportFileName('Fahrrad Größe 1 – 24 h', 'gpx'), 'Fahrrad-Grosse-1-24-h.gpx');
    assert.equal(exportFileName('???', 'kml'), 'export.kml');
  });
  it('drops degenerate geometry', () => {
    const empty = toGeoJson({ name: 'x', features: [{ kind: 'track', segments: [[{ lat: 1, lon: 1 }]] }, { kind: 'line', points: [] }] });
    assert.equal((JSON.parse(empty) as { features: unknown[] }).features.length, 0);
  });
});
