/** @veit/intl — zentrale `Intl`/Locale‑Formatierung für Veit‑Apps */

export * from './VeitIntlFormatting.js';
export {
  intlLanguageKeyForDisplay,
  uiLanguageAutonym,
  foldLanguageSearchText,
  uiLanguageDisplayName,
} from './VeitLanguageDisplayName.js';
export {
  browserKindName,
  clientKindFromUserAgent,
  describeUserAgent,
  osKindName,
  parseUserAgent,
  type VeitBrowserKind,
  type VeitClientKind,
  type VeitClientKindOptions,
  type VeitOsKind,
  type VeitUserAgentInfo,
} from './userAgent.js';
