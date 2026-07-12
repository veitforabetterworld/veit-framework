import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { VeitPersonListRowProfile } from '@veit/react-controls';
import { useVeitDialogNestedZIndexBase, VeitOverlayActionDialog, useManagedOverlayDialogBinding } from '@veit/react-dialog';

import type { VeitPersonRef } from './types.js';

export type VeitPersonPickerPersonRowLabels = {
  emptyNameLabel: string;
  closeAriaLabel: string;
  profilePreviewSuffix: string;
};

export type VeitPersonPickerDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  closeAriaLabel: string;
  searchPlaceholder: string;
  emptyMessage: string;
  noResultsMessage: string;
  mode: 'single' | 'multi';
  excludeUserIds?: ReadonlySet<number>;
  loadCandidates: (query: string) => Promise<VeitPersonRef[]>;
  onConfirm: (selectedIds: number[]) => void | Promise<void>;
  zIndexBase?: number;
  /** Texte für {@link VeitPersonListRowProfile} in jeder Zeile. */
  personRowLabels: VeitPersonPickerPersonRowLabels;
  renderPersonRow?: (props: {
    person: VeitPersonRef;
    selected: boolean;
    onToggle: () => void;
    mode: 'single' | 'multi';
    radioName: string;
    personRowLabels: VeitPersonPickerPersonRowLabels;
  }) => ReactNode;
};

function defaultRow(props: {
  person: VeitPersonRef;
  selected: boolean;
  onToggle: () => void;
  mode: 'single' | 'multi';
  radioName: string;
  personRowLabels: VeitPersonPickerPersonRowLabels;
}): ReactNode {
  const { person, selected, onToggle, mode, personRowLabels } = props;
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`flex w-full items-center gap-3 rounded-xl border px-2 py-2 text-left transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        selected ? 'border-primary/40 bg-primary/5' : 'border-transparent'
      }`}
      onClick={onToggle}
    >
      <VeitPersonListRowProfile
        className="min-w-0 flex-1 pointer-events-none"
        displayName={person.displayName}
        profileImageSrc={person.profileImageSrc ?? null}
        emptyNameLabel={personRowLabels.emptyNameLabel}
        labelHint={person.labelHint}
        subline={person.subline != null && person.subline !== '' ? person.subline : undefined}
        size="sm"
        nameClassName="text-sm"
        profilePreviewSuffix={personRowLabels.profilePreviewSuffix}
        closeAriaLabel={personRowLabels.closeAriaLabel}
      />
      {mode === 'multi' && selected ? (
        <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      ) : null}
    </button>
  );
}

export function VeitPersonPickerDialog({
  open,
  onClose,
  title,
  confirmLabel,
  cancelLabel,
  closeAriaLabel,
  searchPlaceholder,
  emptyMessage,
  noResultsMessage,
  mode,
  excludeUserIds,
  loadCandidates,
  onConfirm,
  zIndexBase: zIndexBaseProp,
  personRowLabels,
  renderPersonRow = defaultRow,
}: VeitPersonPickerDialogProps) {
  const binding = useManagedOverlayDialogBinding(open, onClose);
  const listId = useId();
  const nestedZ = useVeitDialogNestedZIndexBase();
  const zIndexBase = zIndexBaseProp ?? nestedZ ?? 260;
  const radioName = `veit-person-picker-${listId}`;
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<VeitPersonRef[]>([]);
  const [selectedMulti, setSelectedMulti] = useState<Set<number>>(() => new Set());
  const [selectedSingle, setSelectedSingle] = useState<number | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const exclude = excludeUserIds ?? new Set<number>();

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedMulti(new Set());
    setSelectedSingle(null);
    setResults([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    let cancelled = false;
    setBusy(true);
    void (async () => {
      try {
        const rows = await loadCandidates(q);
        if (!cancelled) setResults(rows);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, query, loadCandidates]);

  const choices = useMemo(
    () => results.filter((p) => !exclude.has(p.id)),
    [results, exclude],
  );

  const canConfirm =
    mode === 'multi' ? selectedMulti.size > 0 : selectedSingle !== null;

  const toggleMulti = (id: number) => {
    setSelectedMulti((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <VeitOverlayActionDialog
      binding={binding}
      title={title}
      closeAriaLabel={closeAriaLabel}
      backdropDismissLabel={closeAriaLabel}
      zIndexBase={zIndexBase}
      variant="centered"
      size="lg"
      className="max-w-lg"
      footerProps={{
        busy: confirmBusy,
        cancelLabel,
        saveLabel: confirmLabel,
        saveDisabled: !canConfirm,
        onSave: async () => {
          const ids =
            mode === 'multi'
              ? Array.from(selectedMulti)
              : selectedSingle != null
                ? [selectedSingle]
                : [];
          if (ids.length === 0) return;
          setConfirmBusy(true);
          try {
            await onConfirm(ids);
          } finally {
            setConfirmBusy(false);
          }
        },
      }}
    >
      <div className="space-y-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="input min-h-[44px] w-full"
          autoComplete="off"
        />
        {busy ? <p className="text-xs text-muted-foreground">…</p> : null}
        <div className="max-h-[min(320px,50vh)] overflow-y-auto rounded-xl border border-border/60 p-1">
          {choices.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {results.length === 0 && !busy ? emptyMessage : noResultsMessage}
            </p>
          ) : (
            <ul
              id={listId}
              className="space-y-1"
              role="listbox"
              aria-multiselectable={mode === 'multi' ? true : undefined}
            >
              {choices.map((person) => {
                const selected =
                  mode === 'multi' ? selectedMulti.has(person.id) : selectedSingle === person.id;
                const onToggle =
                  mode === 'multi'
                    ? () => toggleMulti(person.id)
                    : () => setSelectedSingle(person.id);
                return (
                  <li key={person.id} role="presentation">
                    {renderPersonRow({
                      person,
                      selected,
                      onToggle,
                      mode,
                      radioName,
                      personRowLabels,
                    })}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </VeitOverlayActionDialog>
  );
}
