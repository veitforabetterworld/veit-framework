/** Golden angle in degrees — nth tag uses n steps on the hue circle. */
export const TAG_GOLDEN_ANGLE_DEG = 180 * (3 - Math.sqrt(5));

const TAG_SATURATION = 0.62;
const TAG_LIGHTNESS = 0.48;

function hueToRgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

/** @param index1Based 1 = first tag, 4 = fourth tag (4× golden angle on the color wheel). */
export function tagColorHexForIndex(index1Based: number): string {
  const n = Math.max(1, Math.floor(index1Based));
  const hue = (n * TAG_GOLDEN_ANGLE_DEG) % 360;
  const h = hue / 360;
  const s = TAG_SATURATION;
  const l = TAG_LIGHTNESS;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hueToRgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hueToRgb(p, q, h) * 255);
  const b = Math.round(hueToRgb(p, q, h - 1 / 3) * 255);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

export function normalizeTagHexColor(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(s)) return null;
  return s.toLowerCase();
}

export function tagColor(tag: { hex_color?: string | null }): string {
  const raw = String(tag.hex_color ?? '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw;
  return tagColorHexForIndex(1);
}
