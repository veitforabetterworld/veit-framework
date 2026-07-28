/**
 * Anzeigenamen für UI-Sprachen über Intl — nicht in locales/*.json pflegen.
 */
import { resolveIntlLocale } from './VeitIntlFormatting.js';

/** BCP-47-Sprachschlüssel für Intl.DisplayNames.prototype.of (z. B. pt-BR, zh-TW). */
export function intlLanguageKeyForDisplay(languageCode: string): string {
  const raw = languageCode.trim().replace(/_/g, '-');
  const lower = raw.toLowerCase();
  if (!lower) return languageCode;
  const i = lower.indexOf('-');
  if (i === -1) return lower;
  return lower.slice(0, i) + '-' + lower.slice(i + 1).toUpperCase();
}

/**
 * Locale für Endonyme: Sprache benennt sich in „ihrer“ Umgebung (z. B. français unter fr-FR).
 */
function endonymLocaleTagFor(languageCode: string): string {
  const ofKey = intlLanguageKeyForDisplay(languageCode);
  if (ofKey.includes('-')) {
    return ofKey;
  }
  const base = ofKey.toLowerCase();
  if (base === 'en') {
    return 'en-GB';
  }
  return `${base}-${base.toUpperCase()}`;
}

/**
 * Name der Sprache in der jeweiligen Landessprache (Autonym / Endonym), z. B. «Français», «Deutsch».
 */
export function uiLanguageAutonym(languageCode: string): string {
  const ofKey = intlLanguageKeyForDisplay(languageCode);
  const endonymLoc = endonymLocaleTagFor(languageCode);
  try {
    const dn = new Intl.DisplayNames([endonymLoc], { type: 'language' });
    const n = dn.of(ofKey);
    if (n) return n;
  } catch {
    void 0;
  }
  try {
    const dn = new Intl.DisplayNames(undefined, { type: 'language' });
    const n = dn.of(ofKey);
    if (n) return n;
  } catch {
    void 0;
  }
  return ofKey;
}

/**
 * Normalisiert Text für die Sprachsuche: Kleinschreibung und ohne diakritische Zeichen
 * (z. B. „francais“ findet „français“).
 */
export function foldLanguageSearchText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/**
 * Name der Sprache in der aktuell gewählten UI-Sprache (für Untertitel im Sprachdialog).
 */
export function uiLanguageDisplayName(languageCode: string, displayLocale: string): string {
  try {
    const ui = resolveIntlLocale(displayLocale);
    const dn = new Intl.DisplayNames([ui], { type: 'language' });
    const name = dn.of(intlLanguageKeyForDisplay(languageCode));
    if (name) return name;
  } catch {
    void 0;
  }
  return languageCode;
}
