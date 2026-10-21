/** Referenzbreite für Umrechnung WMS-Maßstab → Kachelzoom (256 px) (Mitte Deutschland). */
const SCALE_REF_LAT = 52;

function scaleConstant(lat: number): number {
  return 591_657_550.5 * Math.cos((lat * Math.PI) / 180);
}

/**
 * Kleinster Kachelzoom (256 px), ab dem ein WMS-Layer noch sichtbar ist.
 * Basiert auf MaxScaleDenominator aus GetCapabilities.
 */
export function minZoomForMaxScale(scale: number, lat = SCALE_REF_LAT): number {
  return Math.ceil(Math.log2(scaleConstant(lat) / scale));
}

/**
 * Größter Kachelzoom (256 px), bis zu dem ein WMS-Layer noch sichtbar ist.
 * Basiert auf MinScaleDenominator aus GetCapabilities.
 */
export function maxZoomForMinScale(scale: number, lat = SCALE_REF_LAT): number {
  return Math.floor(Math.log2(scaleConstant(lat) / scale));
}

/** The state services are built for 256 px tiles; MapLibre zoom + 1 is their tile zoom. */
export const TILE_ZOOM_OFFSET = 1;

export function tileZoomOf(mapZoom: number): number {
  return mapZoom + TILE_ZOOM_OFFSET;
}
