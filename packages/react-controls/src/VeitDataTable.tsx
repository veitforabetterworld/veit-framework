import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { VeitDataTableHeaderCell } from './VeitDataTableHeaderCell.js';

export type VeitDataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null | undefined;
  filterable?: boolean;
  /** Für Textsuche in der Ergebnismenge (nach Filter aller Spalten, clientseitig). */
  filterValue?: (row: T) => string;
  align?: 'left' | 'center' | 'right';
  thClassName?: string;
  tdClassName?: string;
};

export type VeitDataTableLabels = {
  sortColumn: string;
  filterColumn: string;
  filterPlaceholder: string;
  clearFilter: string;
};

/** Platzhalter: `{from}`, `{to}`, `{total}`, `{page}`, `{pages}` */
export type VeitDataTablePaginationLabels = {
  summary: string;
  prev: string;
  next: string;
  pageOf: string;
};

export type VeitDataTablePagination =
  | {
      mode?: 'client';
      pageSize: number;
      labels: VeitDataTablePaginationLabels;
    }
  | {
      mode: 'server';
      pageSize: number;
      labels: VeitDataTablePaginationLabels;
      totalCount: number;
      pageIndex: number;
      onPageChange: (pageIndex: number) => void;
    };

function isServerPagination(p: VeitDataTablePagination | undefined): p is Extract<
  VeitDataTablePagination,
  { mode: 'server' }
> {
  return p != null && p.mode === 'server';
}

function compareSort(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  dir: 'asc' | 'desc',
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  let c = 0;
  if (typeof a === 'number' && typeof b === 'number') {
    c = a - b;
  } else {
    c = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  }
  return dir === 'asc' ? c : -c;
}

function applyColumnFilters<T>(
  rows: T[],
  columns: VeitDataTableColumn<T>[],
  filters: Record<string, string>,
): T[] {
  return rows.filter((row) => {
    for (const col of columns) {
      if (!col.filterable || !col.filterValue) continue;
      const q = (filters[col.id] ?? '').trim().toLowerCase();
      if (q === '') continue;
      const v = (col.filterValue(row) ?? '').toLowerCase();
      if (!v.includes(q)) return false;
    }
    return true;
  });
}

function sortRows<T>(
  rows: T[],
  columns: VeitDataTableColumn<T>[],
  sort: { columnId: string; dir: 'asc' | 'desc' } | null,
): T[] {
  if (!sort) return rows;
  const col = columns.find((c) => c.id === sort.columnId);
  if (!col?.sortable || !col.sortValue) return rows;
  const dir = sort.dir;
  return [...rows].sort((a, b) => compareSort(col.sortValue!(a), col.sortValue!(b), dir));
}

export type VeitDataTableProps<T> = {
  columns: VeitDataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string | number;
  labels: VeitDataTableLabels;
  loading?: boolean;
  loadingLabel: ReactNode;
  emptyLabel: ReactNode;
  onRowClick?: (row: T) => void;
  /** Optional: `title`-Attribut pro Datenzeile (z. B. Tooltip). */
  getRowTitle?: (row: T) => string | undefined;
  rowClassName?: (row: T) => string | undefined;
  tableClassName?: string;
  /** z.B. Abstand für breite Tabellen: `min-w-[32rem]` */
  minWidthClassName?: string;
  /**
   * client: Filter/Sort über alle `rows` im Speicher (Standard).
   * server: `rows` werden unverändert angezeigt (z. B. API liefert bereits gefilterte/sortierte Seite).
   */
  processing?: 'client' | 'server';
  /**
   * Filter und Sortierung gelten über alle `rows` (client) bzw. nur Anzeige (server);
   * optional Pagination: client = Slice nach Filter/Sort, server = Steuerung über Parent.
   */
  pagination?: VeitDataTablePagination;
  /** Wenn gesetzt: eigenes `<th>` pro Datenspalte (z. B. DnD-Kopf). */
  renderTh?: (column: VeitDataTableColumn<T>, columnIndex: number) => ReactNode;
  /**
   * Umschließt nur die Kopfzellen der Datenspalten (z. B. `@dnd-kit` SortableContext um die `<th>`).
   * Nur sinnvoll zusammen mit `renderTh`.
   */
  wrapHeaderCells?: (headerCells: ReactNode) => ReactNode;
  /** Zusätzliche `<th>`-Knoten nach den Datenspalten. */
  trailingHeader?: ReactNode;
  /** Zusätzliche `<td>`-Knoten pro Zeile nach den Datenzellen. */
  trailingCell?: (row: T) => ReactNode;
  /** Für `colSpan` bei Leer-/Ladezeile, wenn `trailingHeader` zusätzliche Spalten hat. */
  trailingColumnCount?: number;
  /** Optional `<tfoot>` (ein oder mehrere `<tr>`). */
  tableFooter?: ReactNode;
};

/**
 * Einheitliche Tabelle: Sort/Filter (client), optional Pagination, gemeinsame Kopfzeilen.
 * `processing="server"`: keine clientseitige Filter-/Sort-Logik; optional Server-Pagination.
 */
export function VeitDataTable<T>({
  columns,
  rows,
  getRowKey,
  labels,
  loading = false,
  loadingLabel,
  emptyLabel,
  onRowClick,
  getRowTitle,
  rowClassName,
  tableClassName = 'w-full border-collapse text-sm',
  minWidthClassName = 'min-w-[32rem]',
  processing = 'client',
  pagination,
  renderTh,
  wrapHeaderCells,
  trailingHeader,
  trailingCell,
  trailingColumnCount = 0,
  tableFooter,
}: VeitDataTableProps<T>) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [sortSpec, setSortSpec] = useState<{ columnId: string; dir: 'asc' | 'desc' } | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [filterOpenFor, setFilterOpenFor] = useState<string | null>(null);
  const [clientPageIndex, setClientPageIndex] = useState(0);

  const serverPag = isServerPagination(pagination) ? pagination : null;
  const pageSize = pagination && pagination.pageSize > 0 ? pagination.pageSize : 0;

  useEffect(() => {
    if (!filterOpenFor) return;
    const onDoc = (e: MouseEvent) => {
      if (tableRef.current?.contains(e.target as Node)) return;
      setFilterOpenFor(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [filterOpenFor]);

  const handleSortClick = useCallback((columnId: string, sortable: boolean | undefined) => {
    if (!sortable) return;
    setSortSpec((prev) => {
      if (prev?.columnId !== columnId) return { columnId, dir: 'asc' };
      if (prev.dir === 'asc') return { columnId, dir: 'desc' };
      return null;
    });
  }, []);

  const processedRows = useMemo(() => {
    if (processing === 'server') return rows;
    const filtered = applyColumnFilters(rows, columns, columnFilters);
    return sortRows(filtered, columns, sortSpec);
  }, [rows, columns, columnFilters, sortSpec, processing]);

  const effectivePageIndex = serverPag ? serverPag.pageIndex : clientPageIndex;

  const pageCount =
    pageSize > 0 && processing === 'client'
      ? Math.max(1, Math.ceil(processedRows.length / pageSize))
      : serverPag && pageSize > 0
        ? Math.max(1, Math.ceil(Math.max(0, serverPag.totalCount) / pageSize))
        : 1;

  useEffect(() => {
    if (processing === 'server') return;
    setClientPageIndex(0);
  }, [columnFilters, sortSpec, processing]);

  useEffect(() => {
    if (processing === 'server') return;
    setClientPageIndex((p) => Math.min(p, Math.max(0, pageCount - 1)));
  }, [pageCount, processing]);

  const visibleRows = useMemo(() => {
    if (processing === 'server') return processedRows;
    if (pageSize <= 0) return processedRows;
    const start = clientPageIndex * pageSize;
    return processedRows.slice(start, start + pageSize);
  }, [processedRows, clientPageIndex, pageSize, processing]);

  const colSpan = columns.length + trailingColumnCount;

  const totalForFooter =
    processing === 'server' && serverPag ? Math.max(0, serverPag.totalCount) : processedRows.length;

  const showPagination =
    pageSize > 0 &&
    pagination != null &&
    (processing === 'server' ? totalForFooter > 0 : processedRows.length > 0);

  const fromIdx = showPagination ? effectivePageIndex * pageSize + 1 : processedRows.length > 0 ? 1 : 0;
  const toIdx = showPagination
    ? Math.min((effectivePageIndex + 1) * pageSize, totalForFooter)
    : processedRows.length;

  const canPrev = showPagination && effectivePageIndex > 0;
  const canNext =
    showPagination &&
    (processing === 'server' && serverPag
      ? (effectivePageIndex + 1) * pageSize < totalForFooter
      : effectivePageIndex < pageCount - 1);

  const goPrev = () => {
    if (!pagination || pageSize <= 0) return;
    if (serverPag) {
      serverPag.onPageChange(Math.max(0, effectivePageIndex - 1));
    } else {
      setClientPageIndex((p) => Math.max(0, p - 1));
    }
  };

  const goNext = () => {
    if (!pagination || pageSize <= 0) return;
    if (serverPag) {
      const maxIdx = Math.max(0, Math.ceil(totalForFooter / pageSize) - 1);
      serverPag.onPageChange(Math.min(maxIdx, effectivePageIndex + 1));
    } else {
      setClientPageIndex((p) => Math.min(pageCount - 1, p + 1));
    }
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table ref={tableRef} className={`${tableClassName} ${minWidthClassName}`}>
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {renderTh ? (
                wrapHeaderCells ? (
                  wrapHeaderCells(
                    <>
                      {columns.map((col, columnIndex) => (
                        <Fragment key={col.id}>{renderTh(col, columnIndex)}</Fragment>
                      ))}
                    </>,
                  )
                ) : (
                  columns.map((col, columnIndex) => (
                    <Fragment key={col.id}>{renderTh(col, columnIndex)}</Fragment>
                  ))
                )
              ) : null}
              {!renderTh
                ? columns.map((col) => {
                const sortOn = sortSpec?.columnId === col.id;
                const sortDir: 'asc' | 'desc' | undefined = sortOn ? sortSpec?.dir : undefined;
                const filterOn = col.filterable ? (columnFilters[col.id] ?? '').trim() !== '' : false;
                const align = col.align ?? 'left';
                const alignClass =
                  align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

                return (
                  <th
                    key={col.id}
                    className={`relative px-1 py-2 align-bottom ${alignClass} ${col.thClassName ?? ''}`}
                  >
                    <VeitDataTableHeaderCell
                      label={
                        <div className={`min-h-[44px] min-w-0 px-0.5 py-1 ${alignClass}`}>
                          <span className="line-clamp-2 break-words font-medium leading-tight text-foreground">
                            {col.header}
                          </span>
                        </div>
                      }
                      sortOn={sortOn}
                      filterOn={filterOn}
                      sortDir={sortDir}
                      onSortClick={(e) => {
                        e.stopPropagation();
                        handleSortClick(col.id, col.sortable);
                      }}
                      onFilterClick={(e) => {
                        e.stopPropagation();
                        if (!col.filterable) return;
                        setFilterOpenFor((prev) => (prev === col.id ? null : col.id));
                      }}
                      sortLabel={labels.sortColumn}
                      filterLabel={labels.filterColumn}
                      showSort={!!col.sortable}
                      showFilter={!!col.filterable}
                    />
                    {filterOpenFor === col.id && col.filterable ? (
                      <div
                        className="absolute left-0 top-full z-40 mt-1 min-w-[12rem] max-w-[min(100vw-2rem,20rem)] rounded-md border border-border bg-background p-2 shadow-md"
                        role="dialog"
                        aria-label={labels.filterColumn}
                      >
                        <input
                          type="search"
                          className="input w-full text-sm"
                          placeholder={labels.filterPlaceholder}
                          value={columnFilters[col.id] ?? ''}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({ ...prev, [col.id]: e.target.value }))
                          }
                          autoFocus
                        />
                        <button
                          type="button"
                          className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
                          onClick={() => {
                            setColumnFilters((prev) => {
                              const next = { ...prev };
                              delete next[col.id];
                              return next;
                            });
                            setFilterOpenFor(null);
                          }}
                        >
                          {labels.clearFilter}
                        </button>
                      </div>
                    ) : null}
                  </th>
                );
              })
                : null}
              {trailingHeader}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="p-6 text-muted-foreground">
                  {loadingLabel}
                </td>
              </tr>
            ) : processedRows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="p-6 text-muted-foreground">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  title={getRowTitle?.(row)}
                  className={`border-b border-border/80 align-top ${
                    onRowClick
                      ? 'cursor-pointer touch-manipulation hover:bg-muted/20 active:bg-muted/40'
                      : ''
                  } ${rowClassName?.(row) ?? ''}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => {
                    const align = col.align ?? 'left';
                    const ac =
                      align === 'center'
                        ? 'text-center tabular-nums'
                        : align === 'right'
                          ? 'text-right'
                          : '';
                    return (
                      <td
                        key={col.id}
                        className={`max-w-[24rem] px-2 py-2 align-middle ${ac} ${col.tdClassName ?? ''}`}
                      >
                        {col.cell(row)}
                      </td>
                    );
                  })}
                  {trailingCell ? trailingCell(row) : null}
                </tr>
              ))
            )}
          </tbody>
          {tableFooter}
        </table>
      </div>

      {showPagination && pagination ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <p>
            {pagination.labels.summary
              .replace('{from}', String(fromIdx))
              .replace('{to}', String(toIdx))
              .replace('{total}', String(totalForFooter))}
          </p>
          <div className="flex items-center gap-2">
            <span>
              {pagination.labels.pageOf
                .replace('{page}', String(effectivePageIndex + 1))
                .replace('{pages}', String(pageCount))}
            </span>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={!canPrev || loading}
              onClick={goPrev}
            >
              {pagination.labels.prev}
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={!canNext || loading}
              onClick={goNext}
            >
              {pagination.labels.next}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
