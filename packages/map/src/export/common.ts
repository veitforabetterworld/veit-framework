import type { VeitExportPoint } from './types.js';

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** ISO-8601 in UTC ohne Millisekunden, oder null. */
export function isoTime(time: string | Date | null | undefined): string | null {
  if (time === null || time === undefined || time === '') return null;
  const d = time instanceof Date ? time : new Date(time);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Farbe als 6-stelliges Hex ohne # (klein), Standard 808080. */
export function hex6(color: string | undefined): string {
  const x = (color ?? '').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(x)) {
    return x
      .split('')
      .map((c) => c + c)
      .join('')
      .toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(x)) return x.toLowerCase();
  return '808080';
}

/** Koordinatenzahl ohne Exponentialschreibweise, höchstens 7 Nachkommastellen (≈ 1 cm). */
export function num(value: number, digits = 7): string {
  return String(Number(value.toFixed(digits)));
}

export function closeRing(ring: VeitExportPoint[]): VeitExportPoint[] {
  if (ring.length < 3) return ring;
  const a = ring[0];
  const b = ring[ring.length - 1];
  return a.lat === b.lat && a.lon === b.lon ? ring : [...ring, a];
}

export function hasAlt(p: VeitExportPoint): p is VeitExportPoint & { alt: number } {
  return typeof p.alt === 'number' && Number.isFinite(p.alt);
}
