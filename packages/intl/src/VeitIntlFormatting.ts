/**
 * Einheitliche locale‑ und `Intl`‑basierte Formatierung (Zahlen, Einheiten, Datum, Kartenmaße).
 * React‑frei; geeignet für Browser und Node mit ECMA‑402.
 */

const LOCALE_CODE_RE = /^[a-z]{2}(-[a-z0-9]{2,8})?$/;

const GiB_FACTOR = 1_073_741_824;
const MiB_FACTOR = 1_048_576;

/** Ob `Intl.NumberFormat(..., { style: 'unit' })` in dieser Umgebung sinnvolle Strings liefert. */
export const intlStyleUnitSupported: boolean =
  typeof Intl !== 'undefined' &&
  typeof Intl.NumberFormat !== 'undefined' &&
  (() => {
    try {
      const s = new Intl.NumberFormat(undefined, {
        style: 'unit',
        unit: 'meter',
        maximumFractionDigits: 0,
      }).format(42);
      return typeof s === 'string' && s.length > 0 && /\d/.test(s);
    } catch {
      return false;
    }
  })();

/** Normalisiert UI‑Sprachcodes (trim, `_` → `-`, lower case). Ungültig → null. */
export function coerceLocaleCode(raw: string | null | undefined): string | null {
  if (raw == null || raw === '') return null;
  const n = String(raw).trim().replace(/_/g, '-');
  if (!LOCALE_CODE_RE.test(n)) return null;
  return n.toLowerCase();
}

/**
 * BCP‑47‑Tag zum UI‑Code: „best fit“ über {@link Intl.NumberFormat.supportedLocalesOf}, sonst bereinigtes Tag.
 */
export function resolveIntlLocale(uiLocaleCode: string): string {
  const c = coerceLocaleCode(uiLocaleCode.trim()) ?? 'en';
  const tag = c.replace(/_/g, '-');
  try {
    const sup = Intl.NumberFormat.supportedLocalesOf([tag], { localeMatcher: 'best fit' });
    return sup[0] ?? tag;
  } catch {
    return tag;
  }
}

/** Übersetzte Kurz‑/Fallback‑Suffixe für Karten‑Längen/Flächen (Platzhalter `{{value}}`). */
export interface MapMeasureStrings {
  unavailable: string;
  area_million_km2_template: string;
  fallback_suffix_meter: string;
  fallback_suffix_kilometer: string;
  fallback_suffix_square_meter: string;
  fallback_suffix_square_kilometer: string;
}

export function mapMeasureStringsFromT(t: (key: string) => string): MapMeasureStrings {
  return {
    unavailable: t('map.measure.unavailable'),
    area_million_km2_template: t('map.measure.area_million_km2'),
    fallback_suffix_meter: t('map.measure.fallback_suffix_meter'),
    fallback_suffix_kilometer: t('map.measure.fallback_suffix_kilometer'),
    fallback_suffix_square_meter: t('map.measure.fallback_suffix_square_meter'),
    fallback_suffix_square_kilometer: t('map.measure.fallback_suffix_square_kilometer'),
  };
}

function interpolatePlaceholders(template: string, vars: Record<string, string>): string {
  let s = template;
  for (const [k, v] of Object.entries(vars)) {
    s = s.replace(new RegExp(`\\{\\{\\s*${escapeRe(k)}\\s*\\}\\}`, 'g'), v);
  }
  return s;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD als lokales Kalenderdatum (T12:00:00), sonst normales `Date`-Parsing. */
function coerceToLocalizedDate(input: Date | string | number): Date {
  if (input instanceof Date) return input;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (ISO_DATE_ONLY_RE.test(trimmed)) {
      return new Date(`${trimmed}T12:00:00`);
    }
    return new Date(trimmed);
  }
  return new Date(input);
}

/** Wert und Einheit für `Intl.RelativeTimeFormat`; gerundet, damit "vor 59 Sekunden" nicht "vor 0 Minuten" wird. */
function relativeTimeParts(diffMs: number): [number, Intl.RelativeTimeFormatUnit] {
  const abs = Math.abs(diffMs);
  const sign = diffMs < 0 ? -1 : 1;
  const second = 1000;
  const minute = 60 * second;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) return [sign * Math.round(abs / second), 'second'];
  if (abs < hour) return [sign * Math.floor(abs / minute), 'minute'];
  if (abs < day) return [sign * Math.floor(abs / hour), 'hour'];
  if (abs < 7 * day) return [sign * Math.floor(abs / day), 'day'];
  if (abs < 30 * day) return [sign * Math.floor(abs / (7 * day)), 'week'];
  if (abs < 365 * day) return [sign * Math.floor(abs / (30 * day)), 'month'];
  return [sign * Math.floor(abs / (365 * day)), 'year'];
}

/** Zentrale Formatier‑API für ein fixes aufgelöstes Intl‑Locale. Cache pro Tag. */
export class VeitIntlFormatting {
  private static readonly instances = new Map<string, VeitIntlFormatting>();

  /**
   * @param intlResolvedTag bereits aufgelöstes Locale (Ergebnis von {@link resolveIntlLocale}).
   */
  static forIntlTag(
    intlResolvedTag: string,
    opts?: { styleUnitSupported?: boolean },
  ): VeitIntlFormatting {
    const key = `${intlResolvedTag}\0${opts?.styleUnitSupported ?? intlStyleUnitSupported}`;
    let inst = VeitIntlFormatting.instances.get(key);
    if (!inst) {
      inst = new VeitIntlFormatting(intlResolvedTag, opts?.styleUnitSupported ?? intlStyleUnitSupported);
      VeitIntlFormatting.instances.set(key, inst);
    }
    return inst;
  }

  /** UI‑Manifest‑Code (z. B. `de`, `en`) → Best‑fit‑Locale. */
  static forUiLocale(uiLocaleCode: string): VeitIntlFormatting {
    return VeitIntlFormatting.forIntlTag(resolveIntlLocale(uiLocaleCode));
  }

  private constructor(
    readonly intlResolvedTag: string,
    private readonly unitStyleSupported: boolean,
  ) {}

  decimal(value: number, options?: Intl.NumberFormatOptions): string {
    try {
      return new Intl.NumberFormat(this.intlResolvedTag, options).format(value);
    } catch {
      return String(value);
    }
  }

  /** Nur Datum (ohne Uhrzeit); YYYY-MM-DD wird als lokales Kalenderdatum interpretiert. */
  localizedDate(
    input: Date | string | number,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    const dt = coerceToLocalizedDate(input);
    if (Number.isNaN(dt.valueOf())) {
      return typeof input === 'string' ? input : '';
    }
    const opts = options ?? ({ dateStyle: 'medium' } satisfies Intl.DateTimeFormatOptions);
    try {
      return new Intl.DateTimeFormat(this.intlResolvedTag, opts).format(dt);
    } catch {
      return typeof input === 'string' ? input : dt.toISOString().slice(0, 10);
    }
  }

  /** Datum/Zeit; Fallback ISO bei ungültigem Datum bzw. `Intl`‑Fehler. */
  localizedDateTime(
    input: Date | string | number,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    const dt = coerceToLocalizedDate(input);
    if (Number.isNaN(dt.valueOf())) {
      return typeof input === 'string' ? input : '';
    }
    const opts =
      options ?? ({ dateStyle: 'medium', timeStyle: 'short' } satisfies Intl.DateTimeFormatOptions);
    try {
      return new Intl.DateTimeFormat(this.intlResolvedTag, opts).format(dt);
    } catch {
      return dt.toISOString();
    }
  }

  /**
   * Abstand zu `now` in Worten ("vor 5 Minuten", "in 2 Tagen"). Die Einheit wächst mit dem Abstand:
   * Sekunden unter einer Minute, dann Minuten, Stunden, Tage, Wochen (ab 7 Tagen), Monate (ab 30), Jahre (ab 365).
   */
  relativeTime(input: Date | string | number, now: Date | number = Date.now(), options?: Intl.RelativeTimeFormatOptions): string {
    const dt = coerceToLocalizedDate(input);
    const nowMs = now instanceof Date ? now.getTime() : now;
    if (Number.isNaN(dt.valueOf()) || !Number.isFinite(nowMs)) {
      return typeof input === 'string' ? input : '';
    }
    const [value, unit] = relativeTimeParts(dt.getTime() - nowMs);
    try {
      return new Intl.RelativeTimeFormat(this.intlResolvedTag, options ?? { numeric: 'auto' }).format(value, unit);
    } catch {
      return this.localizedDateTime(dt);
    }
  }

  /** Dauer in Millisekunden, kurz und mit bis zu zwei Einheiten: "1 Min. 21 Sek.", "2 Std. 5 Min.", "850 ms". */
  durationMs(ms: number): string {
    if (!Number.isFinite(ms)) return '—';
    const sign = ms < 0 ? '-' : '';
    const abs = Math.abs(ms);
    if (abs < 1000) return `${sign}${this.unitShort(Math.round(abs), 'millisecond')}`;
    const totalSeconds = Math.round(abs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];
    if (hours > 0) {
      parts.push(this.unitShort(hours, 'hour'));
      if (minutes > 0) parts.push(this.unitShort(minutes, 'minute'));
    } else if (minutes > 0) {
      parts.push(this.unitShort(minutes, 'minute'));
      if (seconds > 0) parts.push(this.unitShort(seconds, 'second'));
    } else {
      parts.push(this.unitShort(seconds, 'second'));
    }
    return `${sign}${parts.join(' ')}`;
  }

  private unitShort(value: number, unit: 'millisecond' | 'second' | 'minute' | 'hour'): string {
    if (this.unitStyleSupported) {
      try {
        return new Intl.NumberFormat(this.intlResolvedTag, { style: 'unit', unit, unitDisplay: 'short' }).format(value);
      } catch {
        /* Fallback unten */
      }
    }
    const suffix = { millisecond: 'ms', second: 's', minute: 'min', hour: 'h' }[unit];
    return `${this.decimal(value, { maximumFractionDigits: 0 })} ${suffix}`;
  }

  moneyFromMinorUnits(minorUnits: number, currencyRaw: string): string {
    const cur = (currencyRaw || 'EUR').toUpperCase();
    try {
      return new Intl.NumberFormat(this.intlResolvedTag, {
        style: 'currency',
        currency: cur,
      }).format(minorUnits / 100);
    } catch {
      const n = this.decimal(minorUnits / 100, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `${n} ${cur}`;
    }
  }

  moneyFromMinorUnitsSigned(minorUnits: number, currencyRaw: string): string {
    const cur = (currencyRaw || 'EUR').toUpperCase();
    try {
      return new Intl.NumberFormat(this.intlResolvedTag, {
        style: 'currency',
        currency: cur,
        signDisplay: 'always',
      }).format(minorUnits / 100);
    } catch {
      const sign = minorUnits > 0 ? '+' : '';
      return `${sign}${this.moneyFromMinorUnits(minorUnits, cur)}`;
    }
  }

  binaryStorageBytes(bytes: number): string {
    const loc = this.intlResolvedTag;
    const nfInt = () => new Intl.NumberFormat(loc, { maximumFractionDigits: 0 });
    const nf1 = () =>
      new Intl.NumberFormat(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const nf2 = () =>
      new Intl.NumberFormat(loc, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    if (!Number.isFinite(bytes) || bytes < 0) return '—';
    if (bytes >= GiB_FACTOR) return `${nf2().format(bytes / GiB_FACTOR)}\u202fGB`;
    if (bytes >= MiB_FACTOR) return `${nf2().format(bytes / MiB_FACTOR)}\u202fMB`;
    if (bytes >= 1024) return `${nf1().format(bytes / 1024)}\u202fKB`;
    try {
      if (this.unitStyleSupported) {
        return new Intl.NumberFormat(loc, {
          style: 'unit',
          unit: 'byte',
          maximumFractionDigits: 0,
          unitDisplay: 'short',
        }).format(bytes);
      }
    } catch {
      /* Fallback unten */
    }
    return `${nfInt().format(bytes)}\u202fB`;
  }

  speedKmPerHour(kmh: number): string {
    try {
      if (this.unitStyleSupported) {
        return new Intl.NumberFormat(this.intlResolvedTag, {
          style: 'unit',
          unit: 'kilometer-per-hour',
          maximumFractionDigits: 0,
          unitDisplay: 'short',
        }).format(kmh);
      }
    } catch {
      /* ignore */
    }
    return `${this.decimal(kmh, { maximumFractionDigits: 0 })}\u202fkm/h`;
  }

  millimetersAsMeters(mm: number): string {
    const m = mm / 1000;
    try {
      if (this.unitStyleSupported) {
        const fracOpts: Pick<Intl.NumberFormatOptions, 'minimumFractionDigits' | 'maximumFractionDigits'> =
          Number.isFinite(m) && Math.abs(m) >= 100
            ? { maximumFractionDigits: 0 }
            : { minimumFractionDigits: 0, maximumFractionDigits: 2 };
        return new Intl.NumberFormat(this.intlResolvedTag, {
          style: 'unit',
          unit: 'meter',
          unitDisplay: 'short',
          ...fracOpts,
        }).format(m);
      }
    } catch {
      /* ignore */
    }
    return `${this.decimal(m, { minimumFractionDigits: 0, maximumFractionDigits: 6 })}\u202fm`;
  }

  stressKnPerSqM(pressureKnM2: number): string {
    const formatted = this.decimal(pressureKnM2, { maximumFractionDigits: 3 });
    return `${formatted}\u202fkN/m²`;
  }

  private formatAreaQuantity(
    value: number,
    unit: 'square-meter' | 'square-kilometer',
    nfOpts: Pick<Intl.NumberFormatOptions, 'minimumFractionDigits' | 'maximumFractionDigits'>,
    s: Pick<MapMeasureStrings, 'fallback_suffix_square_meter' | 'fallback_suffix_square_kilometer'>,
  ): string {
    const suffix =
      unit === 'square-meter' ? s.fallback_suffix_square_meter : s.fallback_suffix_square_kilometer;
    if (this.unitStyleSupported) {
      try {
        return new Intl.NumberFormat(this.intlResolvedTag, {
          ...nfOpts,
          style: 'unit',
          unit,
          unitDisplay: 'short',
        }).format(value);
      } catch {
        /* Fallback */
      }
    }
    const n = new Intl.NumberFormat(this.intlResolvedTag, nfOpts).format(value);
    return `${n}${suffix}`;
  }

  private formatLengthQuantity(
    value: number,
    unit: 'meter' | 'kilometer',
    nfOpts: Pick<Intl.NumberFormatOptions, 'minimumFractionDigits' | 'maximumFractionDigits'>,
    s: Pick<MapMeasureStrings, 'fallback_suffix_meter' | 'fallback_suffix_kilometer'>,
  ): string {
    const suffix = unit === 'meter' ? s.fallback_suffix_meter : s.fallback_suffix_kilometer;
    if (this.unitStyleSupported) {
      try {
        return new Intl.NumberFormat(this.intlResolvedTag, {
          ...nfOpts,
          style: 'unit',
          unit,
          unitDisplay: 'short',
        }).format(value);
      } catch {
        /* Fallback */
      }
    }
    const n = new Intl.NumberFormat(this.intlResolvedTag, nfOpts).format(value);
    return `${n}${suffix}`;
  }

  formatMapLengthM(meters: number, msgs: MapMeasureStrings): string {
    if (!Number.isFinite(meters) || meters < 0) return msgs.unavailable;
    if (meters < 1000) {
      return this.formatLengthQuantity(Math.round(meters), 'meter', { maximumFractionDigits: 0 }, msgs);
    }
    if (meters < 10_000) {
      return this.formatLengthQuantity(
        meters / 1000,
        'kilometer',
        { minimumFractionDigits: 1, maximumFractionDigits: 1 },
        msgs,
      );
    }
    return this.formatLengthQuantity(meters / 1000, 'kilometer', { maximumFractionDigits: 0 }, msgs);
  }

  formatMapAreaM2(areaM2: number, msgs: MapMeasureStrings): string {
    if (!Number.isFinite(areaM2) || areaM2 <= 0) return msgs.unavailable;
    const loc = this.intlResolvedTag;
    const millionKm2InM2 = 1e12;
    const km2 = areaM2 / 1_000_000;

    if (km2 >= 100_000) {
      const mioKm2 = areaM2 / millionKm2InM2;
      let maxFrac = 2;
      if (mioKm2 >= 0.5) maxFrac = 1;
      if (mioKm2 >= 50) maxFrac = 0;
      const numOnly = new Intl.NumberFormat(loc, {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxFrac,
      }).format(mioKm2);
      return interpolatePlaceholders(msgs.area_million_km2_template, { value: numOnly });
    }

    if (areaM2 < 100_000) {
      return this.formatAreaQuantity(Math.round(areaM2), 'square-meter', { maximumFractionDigits: 0 }, msgs);
    }
    if (km2 < 1) {
      return this.formatAreaQuantity(km2, 'square-kilometer', { minimumFractionDigits: 0, maximumFractionDigits: 2 }, msgs);
    }
    if (km2 <= 20) {
      return this.formatAreaQuantity(km2, 'square-kilometer', { minimumFractionDigits: 1, maximumFractionDigits: 1 }, msgs);
    }
    return this.formatAreaQuantity(Math.round(km2), 'square-kilometer', { maximumFractionDigits: 0 }, msgs);
  }
}

/** Freistehende Hilfen (delegieren über {@link VeitIntlFormatting.forUiLocale}). */

export function formatDecimalNumber(uiLocale: string, value: number, options?: Intl.NumberFormatOptions): string {
  return VeitIntlFormatting.forUiLocale(uiLocale).decimal(value, options);
}

export function formatLocalizedDate(
  uiLocale: string,
  input: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  return VeitIntlFormatting.forUiLocale(uiLocale).localizedDate(input, options);
}

export function formatLocalizedDateTime(
  uiLocale: string,
  input: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  return VeitIntlFormatting.forUiLocale(uiLocale).localizedDateTime(input, options);
}

export function formatMoneyFromMinorUnits(
  minorUnits: number,
  currencyRaw: string,
  uiLocale: string,
): string {
  return VeitIntlFormatting.forUiLocale(uiLocale).moneyFromMinorUnits(minorUnits, currencyRaw);
}

export function formatMoneyFromMinorUnitsSigned(
  minorUnits: number,
  currencyRaw: string,
  uiLocale: string,
): string {
  return VeitIntlFormatting.forUiLocale(uiLocale).moneyFromMinorUnitsSigned(minorUnits, currencyRaw);
}

export function formatBinaryStorageBytes(uiLocale: string, bytes: number): string {
  return VeitIntlFormatting.forUiLocale(uiLocale).binaryStorageBytes(bytes);
}

export function formatSpeedKmPerHour(uiLocale: string, kmh: number): string {
  return VeitIntlFormatting.forUiLocale(uiLocale).speedKmPerHour(kmh);
}

export function formatMillimetersAsMetersLength(uiLocale: string, mm: number): string {
  return VeitIntlFormatting.forUiLocale(uiLocale).millimetersAsMeters(mm);
}

export function formatStressKnPerSqM(uiLocale: string, pressureKnM2: number): string {
  return VeitIntlFormatting.forUiLocale(uiLocale).stressKnPerSqM(pressureKnM2);
}

export function formatMapLengthM(meters: number, uiLocale: string, msgs: MapMeasureStrings): string {
  return VeitIntlFormatting.forUiLocale(uiLocale).formatMapLengthM(meters, msgs);
}

export function formatMapAreaM2(areaM2: number, uiLocale: string, msgs: MapMeasureStrings): string {
  return VeitIntlFormatting.forUiLocale(uiLocale).formatMapAreaM2(areaM2, msgs);
}

/**
 * Abstand zu `now` in Worten ("vor 5 Minuten", "in 2 Tagen", "gestern"). `now` ist der Vergleichszeitpunkt (Default: jetzt).
 * Die Einheit wächst mit dem Abstand: Sekunden, Minuten, Stunden, Tage, Wochen, Monate, Jahre.
 */
export function formatRelativeTime(
  input: Date | string | number,
  now: Date | number | undefined,
  uiLocale: string,
  options?: Intl.RelativeTimeFormatOptions,
): string {
  return VeitIntlFormatting.forUiLocale(uiLocale).relativeTime(input, now ?? Date.now(), options);
}

/** Dauer in Millisekunden kurz, mit bis zu zwei Einheiten: de "1 Min. 21 Sek.", en "1 min 21 sec" (Intl‑Kurzform), unter 1 s in ms. */
export function formatDurationMs(ms: number, uiLocale: string): string {
  return VeitIntlFormatting.forUiLocale(uiLocale).durationMs(ms);
}
