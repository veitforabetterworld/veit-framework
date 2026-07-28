import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { VeitOverlayActionDialog } from './VeitDialogPresets.js';
import { useManagedOverlayDialogBinding } from './managedOverlayDialog.js';
import { VeitSearchPickerPanel } from './VeitSearchPickerPanel.js';
import { useVeitSearchPickerQuery, VEIT_SEARCH_DEBOUNCE_MS } from './useVeitSearchPickerQuery.js';

export type VeitSearchPickerDialogProps<T> = Readonly<{
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  searchPlaceholder: string;
  loadingLabel: string;
  emptyLabel: string;
  closeLabel: string;
  fetchItems: (debouncedQuery: string) => Promise<T[]>;
  fetchDeps?: readonly unknown[];
  renderRow: (item: T, pick: () => void) => ReactNode;
  getRowKey: (item: T) => string | number;
  onPick: (item: T) => void;
  debounceMs?: number;
  debounceMsWhenEmpty?: number;
  minQuery?: number;
  fetchEnabled?: boolean;
  filtersSlot?: ReactNode;
  renderResults?: (ctx: {
    items: T[];
    onPick: (item: T) => void;
    renderRow: (item: T, pick: () => void) => ReactNode;
    getRowKey: (item: T) => string | number;
  }) => ReactNode;
  resultsClassName?: string;
  errorClassName?: string;
  emptyClassName?: string;
  showSearchIcon?: boolean;
  dialogProps?: Partial<
    Pick<
      ComponentProps<typeof VeitOverlayActionDialog>,
      'size' | 'variant' | 'className' | 'titleClassName' | 'backdropBlur' | 'backdropClassName' | 'headerClassName' | 'bodyClassName'
    >
  >;
}>;

/**
 * Fertiger Such-Picker-Dialog: Overlay + Debounce-Query + Ergebnisliste.
 */
export function VeitSearchPickerDialog<T>({
  open,
  onClose,
  title,
  searchPlaceholder,
  loadingLabel,
  emptyLabel,
  closeLabel,
  fetchItems,
  fetchDeps = [],
  renderRow,
  getRowKey,
  onPick,
  debounceMs = VEIT_SEARCH_DEBOUNCE_MS,
  debounceMsWhenEmpty,
  minQuery = 0,
  fetchEnabled = true,
  filtersSlot,
  renderResults,
  resultsClassName = 'max-h-[min(50vh,20rem)] space-y-1 overflow-y-auto',
  errorClassName = 'text-sm text-destructive',
  emptyClassName = 'text-sm text-muted-foreground',
  showSearchIcon = true,
  dialogProps,
}: VeitSearchPickerDialogProps<T>) {
  const binding = useManagedOverlayDialogBinding(open, onClose);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const { items, loading, error, hasFetched, queryReady } = useVeitSearchPickerQuery({
    enabled: open && fetchEnabled,
    query,
    minQuery,
    debounceMs,
    debounceMsWhenEmpty,
    fetchItems,
    fetchDeps,
    resetKey: open ? undefined : 'closed',
  });

  const pick = (item: T) => {
    onPick(item);
    onClose();
  };

  const showEmpty = hasFetched && !loading && !error && items.length === 0 && queryReady;

  return (
    <VeitOverlayActionDialog
      title={title}
      binding={binding}
      closeAriaLabel={closeLabel}
      size={dialogProps?.size ?? 'sm'}
      variant={dialogProps?.variant}
      className={dialogProps?.className}
      titleClassName={dialogProps?.titleClassName}
      backdropBlur={dialogProps?.backdropBlur}
      backdropClassName={dialogProps?.backdropClassName}
      headerClassName={dialogProps?.headerClassName}
      bodyClassName={dialogProps?.bodyClassName}
      footerProps={{ dismissOnly: true, busy: false, cancelLabel: closeLabel }}
    >
      <VeitSearchPickerPanel
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={searchPlaceholder}
        showSearchIcon={showSearchIcon}
        autoFocus
        filtersSlot={filtersSlot}
        loading={loading}
        loadingLabel={loadingLabel}
        error={error}
        errorClassName={errorClassName}
        empty={showEmpty}
        emptyLabel={emptyLabel}
        emptyClassName={emptyClassName}
        items={items}
        getRowKey={getRowKey}
        renderRow={renderRow}
        onPick={pick}
        resultsClassName={resultsClassName}
        renderResults={renderResults}
        showResults={hasFetched && queryReady}
      />
    </VeitOverlayActionDialog>
  );
}
