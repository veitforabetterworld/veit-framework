import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
    if (
      (typeof d === 'object' && d !== null) ||
      (typeof b === 'object' && b !== null)
    ) {
      return JSON.stringify(d ?? null) !== JSON.stringify(b ?? null);
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

/** Nach erfolgreichem Speichern: Baseline auf aktuellen Draft setzen (dirty → false). */
export function commitFormBaseline<T>(setBaseline: (next: T) => void, draft: T): void {
  setBaseline(structuredClone(draft));
}

/**
 * Binding für {@link VeitDialogEditActionsFooter}: nach erfolgreichem `onSave` wird die Baseline
 * automatisch auf den aktuellen Draft gesetzt (`getDraft` liest immer den neuesten Stand).
 */
export type DialogFormBaselineBinding = {
  setBaseline: (next: unknown) => void;
  getDraft: () => unknown;
};

/** Nach erfolgreichem Speichern: optional Baseline committen und Dialog schließen. */
export function applyDialogSaveSuccess(options: {
  formBaseline?: DialogFormBaselineBinding;
  dismiss: () => void;
}): void {
  const { formBaseline, dismiss } = options;
  if (formBaseline) {
    commitFormBaseline(formBaseline.setBaseline, formBaseline.getDraft());
  }
  dismiss();
}

export type UseDialogFormBaselineOptions<T extends Record<string, unknown>> = {
  draft: T;
  /** Baseline-Wert beim Öffnen / wenn sich `resetDeps` ändern. */
  resolveBaseline: () => T;
  /** Abhängigkeiten für Baseline-Reset (Entity-Wechsel, Dialog öffnen, …). */
  resetDeps: readonly unknown[];
  /** Baseline nur im Dialog tracken (z. B. `variant === 'dialog'`). Standard: `true`. */
  track?: boolean;
  equals?: (a: T, b: T) => boolean;
};

/**
 * Draft/Baseline-State für Edit-Dialoge: `dirty`, Reset beim Öffnen, `formBaseline` fürs Footer.
 * Mit `formBaseline` in `footerProps` committet {@link VeitDialogEditActionsFooter} die Baseline
 * nach erfolgreichem Speichern automatisch.
 */
export function useDialogFormBaseline<T extends Record<string, unknown>>({
  draft,
  resolveBaseline,
  resetDeps,
  track = true,
  equals,
}: UseDialogFormBaselineOptions<T>) {
  const [baseline, setBaseline] = useState(resolveBaseline);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (!track) return;
    setBaseline(resolveBaseline());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetDeps steuern den Reset
  }, [track, ...resetDeps]);

  const dirty = useFormDirty(draft, baseline, equals);

  const formBaseline = useMemo(
    (): DialogFormBaselineBinding => ({
      setBaseline: (next) => setBaseline(next as T),
      getDraft: () => draftRef.current,
    }),
    [],
  );

  const commitBaseline = useCallback(() => {
    commitFormBaseline(setBaseline, draftRef.current);
  }, []);

  return {
    baseline,
    setBaseline,
    dirty,
    formBaseline,
    commitBaseline,
  };
}
