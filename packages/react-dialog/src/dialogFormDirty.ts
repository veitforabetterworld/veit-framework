import { useMemo } from 'react';

/** Shallow JSON-Vergleich für Draft vs. Baseline. */
export function isDraftDirty<T>(
  draft: T,
  baseline: T,
  equals: (a: T, b: T) => boolean = (a, b) => JSON.stringify(a) === JSON.stringify(b),
): boolean {
  return !equals(draft, baseline);
}

/** Prüft ob mindestens ein Feld vom leeren Baseline-Wert abweicht (Create-Dialoge). */
export function hasAnyFieldInput<D extends Record<string, unknown>>(
  draft: D,
  emptyBaseline: D,
  keys?: (keyof D)[],
): boolean {
  const ks = keys ?? (Object.keys(draft) as (keyof D)[]);
  return ks.some((k) => {
    const d = draft[k];
    const b = emptyBaseline[k];
    if (typeof d === 'string' && typeof b === 'string') {
      return d.trim() !== b.trim();
    }
    return d !== b;
  });
}

/** Memoized Draft-vs-Baseline Dirty-Check. */
export function useFormDirty<T>(
  draft: T,
  baseline: T,
  equals?: (a: T, b: T) => boolean,
): boolean {
  return useMemo(() => isDraftDirty(draft, baseline, equals), [draft, baseline, equals]);
}
