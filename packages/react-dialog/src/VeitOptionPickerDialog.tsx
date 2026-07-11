import { useId, useMemo, type ReactNode } from 'react';
import { useVeitDialogDismiss, useVeitDialogNestedZIndexBase, VeitDialog, VeitDialogFooter } from './VeitDialog.js';

export type VeitOptionPickerItem<T extends string | number = number> = {
  value: T;
  label: string;
  swatchColor?: string;
  /** Optional leading glyph (e.g. Lucide icon) when `showSwatch` is false. */
  icon?: ReactNode;
};

export type VeitOptionPickerDialogProps<T extends string | number = number> = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  items: VeitOptionPickerItem<T>[];
  value: T | null;
  onSelect: (value: T | null) => void;
  showSwatch?: boolean;
  swatchShape?: 'circle' | 'rounded';
  allowNone?: boolean;
  noneLabel?: string;
  closeAriaLabel: string;
  backdropDismissLabel?: string;
  zIndexBase?: number;
  disabled?: boolean;
};

function swatchClass(shape: 'circle' | 'rounded'): string {
  return shape === 'circle' ? 'rounded-full' : 'rounded-lg';
}

function OptionPickerList<T extends string | number>({
  rows,
  value,
  onSelect,
  showSwatch,
  swatchShape,
  noneLabel,
  listId,
  disabled,
}: {
  rows: { key: string; kind: 'none' | 'item'; item?: VeitOptionPickerItem<T> }[];
  value: T | null;
  onSelect: (value: T | null) => void;
  showSwatch: boolean;
  swatchShape: 'circle' | 'rounded';
  noneLabel: string;
  listId: string;
  disabled: boolean;
}) {
  const dismiss = useVeitDialogDismiss();
  return (
    <ul id={listId} className="max-h-[min(360px,55vh)] space-y-1 overflow-y-auto p-0.5" role="listbox">
      {rows.map((row) => {
        if (row.kind === 'none') {
          const selected = value === null;
          return (
            <li key="none" role="option" aria-selected={selected}>
              <button
                type="button"
                disabled={disabled}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition hover:bg-muted/50 ${
                  selected ? 'border-primary/40 bg-primary/5' : 'border-transparent'
                }`.trim()}
                onClick={() => {
                  onSelect(null);
                  dismiss();
                }}
              >
                <span className="font-medium">{noneLabel}</span>
              </button>
            </li>
          );
        }
        const it = row.item!;
        const selected = it.value === value;
        const shape = swatchClass(swatchShape);
        return (
          <li key={String(it.value)} role="option" aria-selected={selected}>
            <button
              type="button"
              disabled={disabled}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition hover:bg-muted/50 ${
                selected ? 'border-primary/40 bg-primary/5' : 'border-transparent'
              }`.trim()}
              onClick={() => {
                onSelect(it.value);
                dismiss();
              }}
            >
              {showSwatch ? (
                <span
                  className={`h-9 w-9 shrink-0 border border-border shadow-sm ${shape}`}
                  style={{ backgroundColor: it.swatchColor ?? 'rgb(var(--color-primary))' }}
                  aria-hidden
                />
              ) : it.icon ? (
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-sm ${
                    selected ? 'border-primary/35 bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground'
                  }`}
                  aria-hidden
                >
                  {it.icon}
                </span>
              ) : null}
              <span className="min-w-0 flex-1 truncate font-medium">{it.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function VeitOptionPickerDialog<T extends string | number = number>({
  open,
  onClose,
  title,
  items,
  value,
  onSelect,
  showSwatch = false,
  swatchShape = 'rounded',
  allowNone = false,
  noneLabel = '—',
  closeAriaLabel,
  backdropDismissLabel,
  zIndexBase: zIndexBaseProp,
  disabled = false,
}: VeitOptionPickerDialogProps<T>) {
  const listId = useId();
  const nestedZ = useVeitDialogNestedZIndexBase();
  const zIndexBase = zIndexBaseProp ?? nestedZ ?? 220;

  const rows = useMemo(() => {
    const out: { key: string; kind: 'none' | 'item'; item?: VeitOptionPickerItem<T> }[] = [];
    if (allowNone) {
      out.push({ key: 'none', kind: 'none' });
    }
    for (const it of items) {
      out.push({ key: String(it.value), kind: 'item', item: it });
    }
    return out;
  }, [items, allowNone]);

  return (
    <VeitDialog
      open={open}
      onClose={onClose}
      title={title}
      closeAriaLabel={closeAriaLabel}
      backdropDismissLabel={backdropDismissLabel ?? closeAriaLabel}
      zIndexBase={zIndexBase}
      disabled={disabled}
      variant="centered"
      size="sm"
      bodyScrollable
      footer={({ dismiss }) => (
        <VeitDialogFooter>
          <button type="button" className="btn-secondary" disabled={disabled} onClick={dismiss}>
            {closeAriaLabel}
          </button>
        </VeitDialogFooter>
      )}
    >
      <OptionPickerList
        rows={rows}
        value={value}
        onSelect={onSelect}
        showSwatch={showSwatch}
        swatchShape={swatchShape}
        noneLabel={noneLabel}
        listId={listId}
        disabled={disabled}
      />
    </VeitDialog>
  );
}
