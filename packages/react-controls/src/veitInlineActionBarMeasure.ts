/** Puffer für Innenabstände, Rundungen und subpixel-Artefakte bei der Platzprüfung. */
export const HEADER_LAYOUT_SAFETY_PX = 24;
/** Mindest-Zusatzbreite zum Verlassen des Icon-only-Modus (verhindert Flackern). */
export const HEADER_LABEL_HYSTERESIS_PX = 48;

export function measureEndContentWidth(endEl: HTMLElement): number {
  return endEl.scrollWidth;
}

export function rowGapPx(rowEl: HTMLElement): number {
  const gapStr = getComputedStyle(rowEl).columnGap || getComputedStyle(rowEl).gap || '8px';
  return (
    Number.parseFloat(String(gapStr).trim().replace('px', '')) ||
    Number.parseFloat(String(gapStr).split(/\s+/)[0] ?? '') ||
    8
  );
}

export function rowFixedOccupiedWidth(
  rowEl: HTMLElement,
  leadingWidth: number,
  logoEl: HTMLElement,
  centerEl: HTMLElement | null | undefined,
): number {
  const gapPx = rowGapPx(rowEl);
  const gapSlots = Math.max(0, rowEl.children.length - 1);
  return (
    leadingWidth +
    logoEl.offsetWidth +
    (centerEl?.offsetWidth ?? 0) +
    gapSlots * gapPx +
    HEADER_LAYOUT_SAFETY_PX
  );
}

export function resolveShowInlineLabels({
  prev,
  rowWidth,
  labeledTooWide,
  iconOnlyTooWide,
  iconOnlyEnterWidthRef,
}: {
  prev: boolean;
  rowWidth: number;
  labeledTooWide: boolean;
  iconOnlyTooWide: boolean;
  iconOnlyEnterWidthRef: { current: number | null };
}): boolean {
  if (iconOnlyTooWide) return false;
  if (labeledTooWide) {
    iconOnlyEnterWidthRef.current = rowWidth;
    return false;
  }
  if (!prev) {
    if (
      iconOnlyEnterWidthRef.current != null &&
      rowWidth < iconOnlyEnterWidthRef.current + HEADER_LABEL_HYSTERESIS_PX
    ) {
      return false;
    }
    iconOnlyEnterWidthRef.current = null;
    return true;
  }
  return true;
}

export function resolveNeedsMenuBySpace({
  prev,
  iconOnlyTooWide,
}: {
  prev: boolean;
  iconOnlyTooWide: boolean;
}): boolean {
  if (iconOnlyTooWide) return true;
  return prev ? false : prev;
}

/** Breite der Geschwister-Elemente in einer Flex-Zeile (flex-grow-Elemente zählen nicht). */
export function siblingOccupiedWidth(rowEl: HTMLElement, selfEl: HTMLElement): number {
  const gapPx = rowGapPx(rowEl);
  let occupied = 0;
  for (const child of rowEl.children) {
    if (child === selfEl) continue;
    const el = child as HTMLElement;
    const flexGrow = Number.parseFloat(getComputedStyle(el).flexGrow || '0');
    if (flexGrow > 0) continue;
    occupied += el.offsetWidth;
  }
  const gapSlots = Math.max(0, rowEl.children.length - 1);
  return occupied + gapSlots * gapPx + HEADER_LAYOUT_SAFETY_PX;
}

/** Breite des Leading-Bereichs für stabile Messung (Zurück mit Label koppelt nicht die Toolbar). */
export function stableLeadingWidth(
  leadingEl: HTMLElement | null,
  labeledWidthRef: { current: number },
): number {
  if (leadingEl == null) {
    labeledWidthRef.current = 0;
    return 0;
  }
  const live = leadingEl.offsetWidth;
  if (live > labeledWidthRef.current) {
    labeledWidthRef.current = live;
  }
  return Math.max(live, labeledWidthRef.current);
}

/** Mess-Refs nach Routen-/Slot-Wechsel zurücksetzen (Hysterese & Leading-Peak). */
export function resetHeaderLayoutMeasureRefs(refs: {
  leadingLabeledWidthRef: { current: number };
  iconOnlyEnterWidthRef: { current: number | null };
}): void {
  refs.leadingLabeledWidthRef.current = 0;
  refs.iconOnlyEnterWidthRef.current = null;
}
