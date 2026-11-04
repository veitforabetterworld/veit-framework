# @veit/intl

Gemeinsame **ECMA‑402 / `Intl`‑Formatierung** für Veit‑Apps (Browser und Node, ohne React).

## Inhalt

- **`VeitIntlFormatting`**: gebündelte API für ein Auflösungs‑Locale (`forUiLocale(...)`, Instanz‑Caching).
- **Freistehende Funktionen** (`formatMoneyFromMinorUnits`, `formatLocalizedDateTime`, …): gleiche Implementierung wie die Klassenmethoden, praktisch für punktuelle Aufrufe.
- **Relative Zeit und Dauer**: `formatRelativeTime(date, now, locale)` ("vor 5 Minuten", Einheit nach Abstand) und `formatDurationMs(ms, locale)` ("1 Min. 21 Sek."); als Methoden `relativeTime` und `durationMs`.
- **`coerceLocaleCode`**, **`resolveIntlLocale`**, **`intlStyleUnitSupported`**.

## Karten‑Länge/-Fläche

`formatMapLengthM`, `formatMapAreaM2` erwarten strukturierte **Übersetzungsstrings** (`MapMeasureStrings`); Hilfe: `mapMeasureStringsFromT(t)` sobald Keys wie `map.measure.unavailable`, `map.measure.area_million_km2`, … existieren.

## Build

```bash
pnpm exec tsc -p tsconfig.json
```
