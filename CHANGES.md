# Änderungen

Hosts (Plenivo, ScanGut) müssen diese Schnitte nachziehen. Hochwasserdienst nutzt den neuen Stand.

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

`VeitAppHeader` und `VeitAppFooter` sind Slot-Leisten ohne Markennamen. `VeitCombobox` ist eine Kopfzeilen-Suche, kein Dialog. `VeitDescriptionList` / `VeitDescriptionRow` sind Label-Wert-Zeilen. `VeitLog` ist vorformatierter Lauf-Text. Theme setzt `--warning`, `--warning-foreground` und `--info`. `.btn-sm` liegt neben `.btn-lg`.
