import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { VeitDataTableHeaderCell } from './VeitDataTableHeaderCell.js';

export type VeitDataTableFilterOption = {
  value: string;
  label: ReactNode;
};

export type VeitDataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null | undefined;
  filterable?: boolean;
  /**
   * `text` (Standard): Freitext-Teilstring über `filterValue`.
   * `enum` / `tags`: Mehrfachauswahl über `filterOptions` und exakter Abgleich mit `filterMatchValue`.
   * `dateRange`: Von/bis-Datumsfilter über `filterMatchValue` (YYYY-MM-DD); optional leere Werte.
   * `numberRange`: Von/bis-Zahlenfilter über `filterMatchValue`; Eingabe in Anzeigeeinheiten, optional `filterNumberDivisor`.
   */
  filterType?: 'text' | 'enum' | 'tags' | 'dateRange' | 'numberRange';
  filterOptions?: VeitDataTableFilterOption[];
  /** Für `enum` / `tags` / `dateRange` / `numberRange`: Rohwert(e) der Zeile zum Abgleich. */
  filterMatchValue?: (row: T) => string | number | null | undefined | readonly string[];
  /** Für `dateRange` / `numberRange`: Chip zum Filtern auf leere/null-Werte (z. B. „offen“). */
  filterAllowEmpty?: boolean;
  /** Für `dateRange` / `numberRange` mit `filterAllowEmpty`: Beschriftung des Leer-Chips (Fallback: `labels.filterEmptyOnly`). */
  filterEmptyLabel?: ReactNode;
  /**
   * Für `numberRange`: Eingabewerte (z. B. Euro) mit diesem Faktor in Rohwerte umrechnen
   * (z. B. `100` wenn `filterMatchValue` Cent liefert).
   */
  filterNumberDivisor?: number;
  /** Für `numberRange`: `step`-Attribut der Zahleneingaben (Standard: `0.01` bei Divisor 100, sonst `any`). */
  filterNumberStep?: string;
  /** Optional: gewählte Filterwerte vor dem Abgleich erweitern (z. B. Tag-Nachfahren). */
  filterExpandSelected?: (selected: string[]) => string[];
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
  filterDateFrom: string;
  filterDateTo: string;
  filterNumberFrom: string;
  filterNumberTo: string;
  filterEmptyOnly: string;
};

type DateRangeFilterState = {
  from: string;
  to: string;
  emptyOnly: boolean;
};

type NumberRangeFilterState = {
  from: string;
  to: string;
  emptyOnly: boolean;
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

function parseMultiFilter(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function serializeMultiFilter(selected: string[]): string {
  return selected.join(',');
}

function parseDateRangeFilter(raw: string): DateRangeFilterState {
  if (!raw.trim()) return { from: '', to: '', emptyOnly: false };
  try {
    const parsed = JSON.parse(raw) as Partial<DateRangeFilterState>;
    if (parsed != null && typeof parsed === 'object') {
      return {
        from: typeof parsed.from === 'string' ? parsed.from : '',
        to: typeof parsed.to === 'string' ? parsed.to : '',
        emptyOnly: Boolean(parsed.emptyOnly),
      };
    }
  } catch {
    /* legacy / invalid */
  }
  return { from: '', to: '', emptyOnly: false };
}

function serializeDateRangeFilter(state: DateRangeFilterState): string {
  if (!state.from && !state.to && !state.emptyOnly) return '';
  return JSON.stringify(state);
}

function dateRangeFilterActive(state: DateRangeFilterState): boolean {
  return state.from !== '' || state.to !== '' || state.emptyOnly;
}

function parseNumberBound(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function parseNumberRangeFilter(raw: string): NumberRangeFilterState {
  if (!raw.trim()) return { from: '', to: '', emptyOnly: false };
  try {
    const parsed = JSON.parse(raw) as {
      from?: number | string | null;
      to?: number | string | null;
      emptyOnly?: boolean;
    };
    if (parsed != null && typeof parsed === 'object') {
      return {
        from:
          parsed.from != null && parsed.from !== '' && Number.isFinite(Number(parsed.from))
            ? String(parsed.from)
            : '',
        to:
          parsed.to != null && parsed.to !== '' && Number.isFinite(Number(parsed.to))
            ? String(parsed.to)
            : '',
        emptyOnly: Boolean(parsed.emptyOnly),
      };
    }
  } catch {
    /* legacy / invalid */
  }
  return { from: '', to: '', emptyOnly: false };
}

function serializeNumberRangeFilter(state: NumberRangeFilterState): string {
  const from = parseNumberBound(state.from);
  const to = parseNumberBound(state.to);
  if (from == null && to == null && !state.emptyOnly) return '';
  return JSON.stringify({ from, to, emptyOnly: state.emptyOnly });
}

function numberRangeFilterActive(state: NumberRangeFilterState): boolean {
  return parseNumberBound(state.from) != null || parseNumberBound(state.to) != null || state.emptyOnly;
}

function normalizeNumberFilterValue(
  matchRaw: string | number | null | undefined | readonly string[],
): number | null {
  if (matchRaw == null) return null;
  if (typeof matchRaw === 'number') {
    return Number.isFinite(matchRaw) ? matchRaw : null;
  }
  if (Array.isArray(matchRaw)) {
    const first = matchRaw[0];
    if (first == null || first === '') return null;
    const n = Number(first);
    return Number.isFinite(n) ? n : null;
  }
  const trimmed = String(matchRaw).trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function numberRangeBoundToRaw(bound: number | null, divisor: number): number | null {
  if (bound == null) return null;
  if (divisor === 1) return bound;
  return Math.round(bound * divisor);
}

function normalizeDateFilterValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 10);
}

function columnFilterActive(
  filterable: boolean | undefined,
  filterType: VeitDataTableColumn<unknown>['filterType'],
  raw: string,
): boolean {
  if (!filterable) return false;
  const type = filterType ?? 'text';
  if (type === 'enum' || type === 'tags') {
    return parseMultiFilter(raw).length > 0;
  }
  if (type === 'dateRange') {
    return dateRangeFilterActive(parseDateRangeFilter(raw));
  }
  if (type === 'numberRange') {
    return numberRangeFilterActive(parseNumberRangeFilter(raw));
  }
  return raw.trim() !== '';
}

function applyColumnFilters<T>(
  rows: T[],
  columns: VeitDataTableColumn<T>[],
  filters: Record<string, string>,
): T[] {
  return rows.filter((row) => {
    for (const col of columns) {
      if (!col.filterable) continue;
      const raw = filters[col.id] ?? '';
      const filterType = col.filterType ?? 'text';

      if (filterType === 'text') {
        if (!col.filterValue) continue;
        const q = raw.trim().toLowerCase();
        if (q === '') continue;
        const v = (col.filterValue(row) ?? '').toLowerCase();
        if (!v.includes(q)) return false;
        continue;
      }

      if (filterType === 'enum' || filterType === 'tags') {
        let selected = parseMultiFilter(raw);
        if (selected.length === 0) continue;
        if (col.filterExpandSelected) {
          selected = col.filterExpandSelected(selected);
        }
        const matchRaw = col.filterMatchValue?.(row);
        const matchValues =
          matchRaw == null
            ? []
            : Array.isArray(matchRaw)
              ? matchRaw.map(String)
              : [String(matchRaw)];
        if (!matchValues.some((v) => selected.includes(v))) return false;
        continue;
      }

      if (filterType === 'dateRange') {
        const { from, to, emptyOnly } = parseDateRangeFilter(raw);
        if (!from && !to && !emptyOnly) continue;
        const matchRaw = col.filterMatchValue?.(row);
        const dateStr = Array.isArray(matchRaw)
          ? normalizeDateFilterValue(matchRaw[0] as string | null | undefined)
          : normalizeDateFilterValue(matchRaw as string | null | undefined);
        const isEmpty = dateStr == null;
        if (emptyOnly) {
          if (!isEmpty) return false;
          continue;
        }
        if (isEmpty) return false;
        if (from && dateStr < from) return false;
        if (to && dateStr > to) return false;
        continue;
      }

      if (filterType === 'numberRange') {
        const { from, to, emptyOnly } = parseNumberRangeFilter(raw);
        const fromBound = parseNumberBound(from);
        const toBound = parseNumberBound(to);
        if (fromBound == null && toBound == null && !emptyOnly) continue;
        const matchRaw = col.filterMatchValue?.(row);
        const numValue = normalizeNumberFilterValue(
          matchRaw == null
            ? null
            : Array.isArray(matchRaw)
              ? matchRaw
              : matchRaw,
        );
        const isEmpty = numValue == null;
        if (emptyOnly) {
          if (!isEmpty) return false;
          continue;
        }
        if (isEmpty) return false;
        const divisor = col.filterNumberDivisor ?? 1;
        const fromRaw = numberRangeBoundToRaw(fromBound, divisor);
        const toRaw = numberRangeBoundToRaw(toBound, divisor);
        if (fromRaw != null && numValue < fromRaw) return false;
        if (toRaw != null && numValue > toRaw) return false;
      }
    }
    return true;
  });
}

type VeitDataTableOptionFilterProps = {
  options: VeitDataTableFilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  clearLabel: string;
  onClear: () => void;
};

type VeitDataTableDateRangeFilterProps = {
  state: DateRangeFilterState;
  onChange: (state: DateRangeFilterState) => void;
  allowEmpty: boolean;
  emptyLabel: ReactNode;
  fromLabel: string;
  toLabel: string;
  clearLabel: string;
  onClear: () => void;
};

type VeitDataTableNumberRangeFilterProps = {
  state: NumberRangeFilterState;
  onChange: (state: NumberRangeFilterState) => void;
  allowEmpty: boolean;
  emptyLabel: ReactNode;
  fromLabel: string;
  toLabel: string;
  clearLabel: string;
  step: string;
  onClear: () => void;
};

function VeitDataTableNumberRangeFilter({
  state,
  onChange,
  allowEmpty,
  emptyLabel,
  fromLabel,
  toLabel,
  clearLabel,
  step,
  onClear,
}: VeitDataTableNumberRangeFilterProps) {
  const active = numberRangeFilterActive(state);

  return (
    <>
      {allowEmpty ? (
        <button
          type="button"
          className={`mb-2 rounded-full border px-2.5 py-1 text-xs transition-colors ${
            state.emptyOnly
              ? 'border-primary bg-primary/10 font-medium text-primary'
              : 'border-border/70 text-muted-foreground hover:border-border hover:text-foreground'
          }`}
          onClick={() =>
            onChange({
              ...state,
              emptyOnly: !state.emptyOnly,
              from: !state.emptyOnly ? '' : state.from,
              to: !state.emptyOnly ? '' : state.to,
            })
          }
        >
          {emptyLabel}
        </button>
      ) : null}
      <div className={`space-y-2 ${state.emptyOnly ? 'pointer-events-none opacity-50' : ''}`}>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">{fromLabel}</span>
          <input
            type="number"
            className="input w-full text-sm tabular-nums"
            value={state.from}
            step={step}
            onChange={(e) => onChange({ ...state, from: e.target.value, emptyOnly: false })}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">{toLabel}</span>
          <input
            type="number"
            className="input w-full text-sm tabular-nums"
            value={state.to}
            step={step}
            min={state.from || undefined}
            onChange={(e) => onChange({ ...state, to: e.target.value, emptyOnly: false })}
          />
        </label>
      </div>
      {active ? (
        <button
          type="button"
          className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
          onClick={onClear}
        >
          {clearLabel}
        </button>
      ) : null}
    </>
  );
}

function VeitDataTableDateRangeFilter({
  state,
  onChange,
  allowEmpty,
  emptyLabel,
  fromLabel,
  toLabel,
  clearLabel,
  onClear,
}: VeitDataTableDateRangeFilterProps) {
  const active = dateRangeFilterActive(state);

  return (
    <>
      {allowEmpty ? (
        <button
          type="button"
          className={`mb-2 rounded-full border px-2.5 py-1 text-xs transition-colors ${
            state.emptyOnly
              ? 'border-primary bg-primary/10 font-medium text-primary'
              : 'border-border/70 text-muted-foreground hover:border-border hover:text-foreground'
          }`}
          onClick={() =>
            onChange({
              ...state,
              emptyOnly: !state.emptyOnly,
              from: !state.emptyOnly ? '' : state.from,
              to: !state.emptyOnly ? '' : state.to,
            })
          }
        >
          {emptyLabel}
        </button>
      ) : null}
      <div className={`space-y-2 ${state.emptyOnly ? 'pointer-events-none opacity-50' : ''}`}>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">{fromLabel}</span>
          <input
            type="date"
            className="input w-full text-sm"
            value={state.from}
            onChange={(e) => onChange({ ...state, from: e.target.value, emptyOnly: false })}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">{toLabel}</span>
          <input
            type="date"
            className="input w-full text-sm"
            value={state.to}
            min={state.from || undefined}
            onChange={(e) => onChange({ ...state, to: e.target.value, emptyOnly: false })}
          />
        </label>
      </div>
      {active ? (
        <button
          type="button"
          className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
          onClick={onClear}
        >
          {clearLabel}
        </button>
      ) : null}
    </>
  );
}

function VeitDataTableOptionFilter({
  options,
  selected,
  onChange,
  clearLabel,
  onClear,
}: VeitDataTableOptionFilterProps) {
  const toggle = (value: string) => {
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  };

  return (
    <>
      <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
        {options.map((opt) => {
          const on = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                on
                  ? 'border-primary bg-primary/10 font-medium text-primary'
                  : 'border-border/70 text-muted-foreground hover:border-border hover:text-foreground'
              }`}
              onClick={() => toggle(opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {selected.length > 0 ? (
        <button
          type="button"
          className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
          onClick={onClear}
        >
          {clearLabel}
        </button>
      ) : null}
    </>
  );
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
  /** Gesteuerte Spaltenfilter (z. B. Sync mit externem Tag-Filter). */
  columnFilters?: Record<string, string>;
  onColumnFiltersChange?: (filters: Record<string, string>) => void;
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
  columnFilters: columnFiltersProp,
  onColumnFiltersChange,
}: VeitDataTableProps<T>) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [sortSpec, setSortSpec] = useState<{ columnId: string; dir: 'asc' | 'desc' } | null>(null);
  const [uncontrolledColumnFilters, setUncontrolledColumnFilters] = useState<Record<string, string>>({});
  const isFiltersControlled = columnFiltersProp !== undefined;
  const columnFilters = isFiltersControlled ? columnFiltersProp : uncontrolledColumnFilters;

  const patchColumnFilters = useCallback(
    (updater: (prev: Record<string, string>) => Record<string, string>) => {
      if (isFiltersControlled) {
        onColumnFiltersChange?.(updater(columnFiltersProp ?? {}));
      } else {
        setUncontrolledColumnFilters(updater);
      }
    },
    [columnFiltersProp, isFiltersControlled, onColumnFiltersChange],
  );
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
                const filterOn = columnFilterActive(col.filterable, col.filterType, columnFilters[col.id] ?? '');
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
                        {col.filterType === 'dateRange' ? (
                          <VeitDataTableDateRangeFilter
                            state={parseDateRangeFilter(columnFilters[col.id] ?? '')}
                            allowEmpty={!!col.filterAllowEmpty}
                            emptyLabel={col.filterEmptyLabel ?? labels.filterEmptyOnly}
                            fromLabel={labels.filterDateFrom}
                            toLabel={labels.filterDateTo}
                            clearLabel={labels.clearFilter}
                            onChange={(state) =>
                              patchColumnFilters((prev) => ({
                                ...prev,
                                [col.id]: serializeDateRangeFilter(state),
                              }))
                            }
                            onClear={() => {
                              patchColumnFilters((prev) => {
                                const next = { ...prev };
                                delete next[col.id];
                                return next;
                              });
                              setFilterOpenFor(null);
                            }}
                          />
                        ) : col.filterType === 'numberRange' ? (
                          <VeitDataTableNumberRangeFilter
                            state={parseNumberRangeFilter(columnFilters[col.id] ?? '')}
                            allowEmpty={!!col.filterAllowEmpty}
                            emptyLabel={col.filterEmptyLabel ?? labels.filterEmptyOnly}
                            fromLabel={labels.filterNumberFrom}
                            toLabel={labels.filterNumberTo}
                            clearLabel={labels.clearFilter}
                            step={
                              col.filterNumberStep ??
                              (col.filterNumberDivisor === 100 ? '0.01' : 'any')
                            }
                            onChange={(state) =>
                              patchColumnFilters((prev) => ({
                                ...prev,
                                [col.id]: serializeNumberRangeFilter(state),
                              }))
                            }
                            onClear={() => {
                              patchColumnFilters((prev) => {
                                const next = { ...prev };
                                delete next[col.id];
                                return next;
                              });
                              setFilterOpenFor(null);
                            }}
                          />
                        ) : (col.filterType === 'enum' || col.filterType === 'tags') &&
                          col.filterOptions &&
                          col.filterOptions.length > 0 ? (
                          <VeitDataTableOptionFilter
                            options={col.filterOptions}
                            selected={parseMultiFilter(columnFilters[col.id] ?? '')}
                            onChange={(selected) =>
                              patchColumnFilters((prev) => ({
                                ...prev,
                                [col.id]: serializeMultiFilter(selected),
                              }))
                            }
                            clearLabel={labels.clearFilter}
                            onClear={() => {
                              patchColumnFilters((prev) => {
                                const next = { ...prev };
                                delete next[col.id];
                                return next;
                              });
                              setFilterOpenFor(null);
                            }}
                          />
                        ) : (
                          <>
                            <input
                              type="search"
                              className="input w-full text-sm"
                              placeholder={labels.filterPlaceholder}
                              value={columnFilters[col.id] ?? ''}
                              onChange={(e) =>
                                patchColumnFilters((prev) => ({ ...prev, [col.id]: e.target.value }))
                              }
                              autoFocus
                            />
                            <button
                              type="button"
                              className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
                              onClick={() => {
                                patchColumnFilters((prev) => {
                                  const next = { ...prev };
                                  delete next[col.id];
                                  return next;
                                });
                                setFilterOpenFor(null);
                              }}
                            >
                              {labels.clearFilter}
                            </button>
                          </>
                        )}
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
