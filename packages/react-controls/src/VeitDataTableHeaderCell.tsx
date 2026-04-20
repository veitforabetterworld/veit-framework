import { ArrowDown, ArrowUp, ArrowUpDown, ListFilter } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';

import { veitTableHeaderIconBtn, veitTableHeaderIconBtnActive } from './veitTableStyles.js';

export type VeitDataTableHeaderCellProps = {
  /** Hauptbereich (z.B. Spaltenüberschrift oder Spaltenname). */
  label: ReactNode;
  sortOn: boolean;
  filterOn: boolean;
  sortDir?: 'asc' | 'desc';
  onSortClick: (e: MouseEvent) => void;
  onFilterClick: (e: MouseEvent) => void;
  /** z.B. `t('veit_table.sort_column')` */
  sortLabel: string;
  /** z.B. `t('veit_table.filter_column')` */
  filterLabel: string;
  showSort?: boolean;
  showFilter?: boolean;
  /** z.B. `veitSortableExcludeFromDragProps` auf die Icon-Gruppe. */
  iconGroupProps?: React.HTMLAttributes<HTMLDivElement>;
};

/**
 * Kopfzelle mit sortier- und filterbaren Icons – Layout wie VeitDataTable-Standardkopf.
 */
export function VeitDataTableHeaderCell({
  label,
  sortOn,
  filterOn,
  sortDir,
  onSortClick,
  onFilterClick,
  sortLabel,
  filterLabel,
  showSort = true,
  showFilter = true,
  iconGroupProps,
}: VeitDataTableHeaderCellProps) {
  return (
    <div className="flex min-w-0 flex-1 items-end gap-0.5">
      <div className="flex min-w-0 flex-1 items-end gap-0.5">{label}</div>
      {(showSort || showFilter) && (
        <div
          className="flex shrink-0 items-center gap-0.5 pb-0.5"
          {...(iconGroupProps ?? {})}
        >
          {showSort ? (
            <button
              type="button"
              className={`${veitTableHeaderIconBtn} ${sortOn ? veitTableHeaderIconBtnActive : ''}`}
              title={sortLabel}
              aria-label={sortLabel}
              onClick={onSortClick}
            >
              {sortDir === 'asc' ? (
                <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
              ) : sortDir === 'desc' ? (
                <ArrowDown className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
              ) : (
                <ArrowUpDown className="h-3.5 w-3.5 opacity-70" strokeWidth={2} aria-hidden />
              )}
            </button>
          ) : null}
          {showFilter ? (
            <button
              type="button"
              className={`${veitTableHeaderIconBtn} ${filterOn ? veitTableHeaderIconBtnActive : ''}`}
              title={filterLabel}
              aria-label={filterLabel}
              onClick={onFilterClick}
            >
              <ListFilter className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
