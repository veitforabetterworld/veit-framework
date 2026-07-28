import type { ReactNode } from 'react';
import { Search } from 'lucide-react';

export function veitSearchInputClass(showIcon = true): string {
  return `input w-full text-sm${showIcon ? ' pl-8' : ''}`;
}

export type VeitSearchPickerPanelProps<T> = Readonly<{
  query: string;
  onQueryChange: (value: string) => void;
  searchPlaceholder: string;
  showSearchIcon?: boolean;
  autoFocus?: boolean;
  queryHint?: ReactNode;
  filtersSlot?: ReactNode;
  loading?: boolean;
  loadingLabel?: ReactNode;
  error?: string | null;
  errorClassName?: string;
  empty?: boolean;
  emptyLabel?: ReactNode;
  emptyClassName?: string;
  items: T[];
  getRowKey: (item: T) => string | number;
  renderRow: (item: T, pick: () => void) => ReactNode;
  onPick: (item: T) => void;
  resultsClassName?: string;
  renderResults?: (ctx: {
    items: T[];
    onPick: (item: T) => void;
    renderRow: (item: T, pick: () => void) => ReactNode;
    getRowKey: (item: T) => string | number;
  }) => ReactNode;
  listWrapperClassName?: string;
  showResults?: boolean;
}>;

/** Lightweight row button for search results (avoids react-controls ↔ react-dialog cycle). */
export function renderVeitPickerChoiceRow(
  pick: () => void,
  children: ReactNode,
  options?: { disabled?: boolean; className?: string; contentClassName?: string },
) {
  return (
    <button
      type="button"
      disabled={options?.disabled}
      onClick={pick}
      className={
        options?.className ??
        'flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-muted'
      }
    >
      <span className={`flex min-w-0 flex-1 items-center gap-2 ${options?.contentClassName ?? ''}`.trim()}>
        {children}
      </span>
    </button>
  );
}

export function VeitSearchPickerPanel<T>({
  query,
  onQueryChange,
  searchPlaceholder,
  showSearchIcon = true,
  autoFocus = false,
  queryHint,
  filtersSlot,
  loading = false,
  loadingLabel,
  error = null,
  errorClassName = 'text-sm text-destructive',
  empty = false,
  emptyLabel,
  emptyClassName = 'text-sm text-muted-foreground',
  items,
  getRowKey,
  renderRow,
  onPick,
  resultsClassName = 'max-h-[min(50vh,20rem)] space-y-1 overflow-y-auto',
  renderResults,
  listWrapperClassName = 'relative min-h-[100px] rounded-xl border border-border/60 bg-muted/10',
  showResults = true,
}: VeitSearchPickerPanelProps<T>) {
  const pick = (item: T) => onPick(item);

  return (
    <div className="space-y-3">
      <div className="relative">
        {showSearchIcon ? (
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        ) : null}
        <input
          type="search"
          className={`${veitSearchInputClass(showSearchIcon)} min-h-[44px] text-base sm:text-sm`}
          autoFocus={autoFocus}
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>
      {queryHint}
      {filtersSlot}
      {error ? <p className={errorClassName}>{error}</p> : null}
      {loading && loadingLabel ? <p className="text-sm text-muted-foreground">{loadingLabel}</p> : null}
      {empty && emptyLabel ? <p className={emptyClassName}>{emptyLabel}</p> : null}
      {showResults && !loading && !error && items.length > 0 ? (
        renderResults ? (
          renderResults({ items, onPick: pick, renderRow, getRowKey })
        ) : (
          <div className={listWrapperClassName}>
            <ul className={resultsClassName}>
              {items.map((item) => (
                <li key={getRowKey(item)}>{renderRow(item, () => pick(item))}</li>
              ))}
            </ul>
          </div>
        )
      ) : null}
    </div>
  );
}
