/**
 * Neutrales Modell für den Export von Kartendaten nach KML, GPX und GeoJSON.
 *
 * Der Host bildet seine eigenen Objekte (Kartenelemente, Tracker-Verläufe …) darauf ab; die Schreiber kennen nur
 * dieses Modell. Koordinaten in WGS84, Höhe in Metern, Zeit als ISO-8601-String oder Date.
 */

export type VeitExportPoint = {
  lat: number;
  lon: number;
  /** Höhe über dem Meer in Metern. */
  alt?: number | null;
  time?: string | Date | null;
};

type VeitExportFeatureBase = {
  name?: string;
  description?: string;
  /** Farbe als #rrggbb oder #rgb; Standard grau. */
  color?: string;
  /** Gruppierung (KML-Ordner, GPX/GeoJSON-Eigenschaft `folder`), z. B. eine Kartenebene. */
  folder?: string;
  /** Zusätzliche Eigenschaften: KML ExtendedData, GPX extensions, GeoJSON properties. */
  properties?: Record<string, string | number | boolean>;
};

export type VeitExportFeature =
  | (VeitExportFeatureBase & { kind: 'point'; point: VeitExportPoint })
  /** Linienzug ohne Zeitbezug (Weg, Strecke). */
  | (VeitExportFeatureBase & { kind: 'line'; points: VeitExportPoint[] })
  /** Fläche; der Ring wird bei Bedarf geschlossen. */
  | (VeitExportFeatureBase & { kind: 'polygon'; ring: VeitExportPoint[] })
  /** Aufgezeichneter Verlauf: Punkte mit Zeit, in Segmente geteilt (Lücken). */
  | (VeitExportFeatureBase & { kind: 'track'; segments: VeitExportPoint[][] });

export type VeitExportDocument = {
  name: string;
  description?: string;
  /** Erzeugende Anwendung (GPX creator). */
  creator?: string;
  features: VeitExportFeature[];
};

export type VeitExportFormat = 'kml' | 'gpx' | 'geojson';
