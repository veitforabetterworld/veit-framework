# Änderungen

## Pin

Stand 2026-10-21. Framework-`development` ist `877efbb`. Plenivo liegt auf `de5654a63737c5e7f8a25dac2d36a8f7041d265d` (`origin/deploy`), nutzt noch Leaflet und wird auf `<VeitMap>` umgestellt. ScanGut hat keine Karte.

Flurkarte-Tests aus Plenivo (`mapCadastralSources`, `mapCadastralStateLookup`, `mapCadastralZoom`) sind in `@veit/map` vorhanden. GPX, GeoJSON-Import, Geodäsie und Kartensuche bleiben in Plenivo, die Funktionen liegen nicht im Paket.

## Host-Werkzeuge

`scripts/no-custom-css.mjs` prüft einen Host-`src`-Pfad (Argument). `@veit/react-controls` exportiert `AppShell`.

## MapLibre 6

Peer und Abhängigkeit sind `maplibre-gl` ^6.4.1 (schließt Advisory 1193680). Es gibt keinen Default-Export mehr (`import * as maplibregl from "maplibre-gl"`). Paint-Ausdrücke kommen als `ExpressionSpecification` aus dem Paket.

## `@veit/map`, `@veit/react-map`

Neu. Gemeinsame Karte für Hochwasserdienst und Plenivo, siehe `packages/map/README.md`.

Plenivo nutzt noch Leaflet und wird auf `<VeitMap>` umgestellt. Dabei gilt: Leaflet-Zoom = MapLibre-Zoom + 1, Hintergründe werden über `basemap` gesteuert (IDs `osm`, `satellite`, `topo`, `official`, `cadastral`), und die Flurkarten-Quellen kommen aus `@veit/map` statt aus `mapCadastralSources.ts`. ScanGut hat keine Karte. Hochwasserdienst nutzt den neuen Stand.

`configureMap` gilt für Karten, die danach entstehen. Jede Karte hält ihre eigene Kopie. `config` an `<VeitMap>` überschreibt sie für diese Karte. Custom-Layer überleben einen Style-Wechsel nicht und werden nicht mitkopiert. `useMapLayer` setzt Host-Ebenen nach jedem Style-Load neu. `devHandle` wird beim Unmount von `window` gelöscht. Die 3D-Welt kippt die Kamera nur einmal. three.js liegt hinter `@veit/map/world3d` und wird vom Host per `import()` geladen.

## Theme

`@veit/react-controls/theme.css` setzt die shadcn-Variablen und die Klassen `.btn`, `.input`, `.card`. Der Host lädt davor Tailwind (`@import "tailwindcss"`) und setzt `@source` auf App und Framework. Danach importiert er `theme.css`.

Vorher: Hosts haben `.btn-primary` und `.input` selbst definiert.
Nachher: Theme importieren und die Variablen überschreiben. Eigene Kopien der Klassen entfernen, sonst gewinnen sie je nach Reihenfolge.

## Entfernte Aliase

Weg: `DialogDetailField`, `DialogFormField`, `DialogDetailSection`, `DialogDetailSectionTitle`, `DialogToolbarButton`, `DialogInsetScroll`, `DialogSoftPanel`, `DialogDashedCta`, `DialogStickyActions`, `DeleteIconButtonLabel`, `dialogDetailFormStackClass`, `dialogDetailInputClass`, `dialogDetailTextareaClass`, `dialogDetailSelectClass`, `inputCompactClass`, `dialogDetailPickerTriggerClass`, `dialogDetailLabelClass`, `DELETE_ICON_BUTTON_CLASS`.

Stattdessen die `Veit…`-Namen und `veit…Class` / `VEIT_DELETE_ICON_BUTTON_CLASS`.

## `VeitSelect`

Vorher: natives `<select>` mit `children` als `<option>`.
Nachher: Radix Select. Props `options: { value, label, disabled? }[]`, `value`, `onValueChange`. `value` darf nicht leer sein.

## `VeitSwitch`

Vorher: `<button role="switch">`.
Nachher: `@radix-ui/react-switch`. Dieselben Props.

## `VeitButton`, `VeitPanel`

Neu. `VeitButton` hat `variant` `primary` | `secondary` | `destructive` und `asChild` für Links. `VeitPanel` ist eine `.card`-Fläche.

## Dialog

Die zentrierte Hülle von `VeitDialog` nutzt `@radix-ui/react-dialog` (Fokus, Portal). Escape bleibt am bisherigen History-Listener, Radix schluckt das Event. Die Bottom-Dock-Darstellung bleibt ein eigenes Portal, weil sie in einen Host-Knoten andockt.

## React

Peer bleibt `>=18`. Der Typecheck im Repository nutzt React 19, damit Lucide und Radix dieselbe `@types/react`-Linie sehen. Hosts mit React 18 müssen ihre Typen nicht umstellen, solange sie das Framework nicht selbst mit React-18-Typen gegen Lucide prüfen.

## Icons

`VeitBackButton` zeigt ohne eigenes `icon` ein Lucide-`ArrowLeft` statt des Textpfeils.

## `VeitPageHeader`

Vorher: BEM-Klassen `veit-page-header__title` und `bemPrefix`.
Nachher: Tailwind-Tokens. `bemPrefix` gibt es nicht mehr. Optik kommt aus dem Theme.

## Neu

Der Standard von `:root` ist dunkel. `[data-theme="light"]` setzt dieselben Namen auf die helle Fläche. Produktfarben (`band`, `catchment`, `series`, `depth-ramp`, `temp-ramp`) und `animate-ticker` liegen im Theme. `VeitButton` hat `ghost`. `VeitRange` zeichnet den Füllstand.

`.map-surface` färbt MapLibre-Controls und Popups über die Token. `VeitPanel` darf `ul` und `li` sein. `VeitStatusBadge` in `sm` nutzt `text-xs`.

`@source` zeigt auf das Framework-Paket, sonst fehlen dessen Utilities (`w-12`, `top-1/2`, `h-5`) in der Host-CSS. Wahlflächen nutzen `rounded-lg` wie `.btn` und `.input`, Kacheln `rounded-xl` wie `.card`. Segment-Wahl hängt an `.btn`, sonst fehlt der Radius. `.btn-primary`, `.btn-secondary` und `.btn-destructive` tragen `rounded-lg` auch ohne `.btn`. `.input` setzt `appearance: none`, damit `type="search"` keine Browser-Lupe zeichnet. `VeitList` setzt `list-none`. Leere Zustände stapeln mit `flex`. `settings-subsection` und `settings-page-group` haben Token-Klassen. `--color-on-primary` zeigt auf `--primary-foreground`.

`VeitAppHeader` stapelt unter `sm` Marke, Navigation und Werkzeuge. Ab `sm` liegen sie in einer Zeile. Die Werkzeugleiste bricht um. `density="compact"` hält die Leiste auch schmal in einer Zeile.

`@veit/address` und `@veit/field-tags` liefern Typen aus `src/index.ts`. Der Typecheck braucht dafür keinen vorherigen `dist`-Build. Der Laufzeit-Import bleibt `dist/index.js`.
