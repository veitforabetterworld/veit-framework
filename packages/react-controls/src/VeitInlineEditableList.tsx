import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import {
  closestCenter,
  defaultDropAnimationSideEffects,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
  arrayMove,
  useVeitDndSensors,
  VeitDndContext,
  VeitSortableRegion,
  VeitSortableActivatorRow,
  verticalListSortingStrategy,
} from '@veit/react-dnd';
import { GripVertical, Plus } from 'lucide-react';
import type { VeitDeleteConfirmConfig } from '@veit/react-dialog';
import { VeitDeleteButton } from './VeitDeleteButton.js';
import { VeitSwitch } from './VeitSwitch.js';

/** Gemeinsame Zeilenoptik (inline bearbeitbare Listen, z. B. Typwerte, Labels). */
export const veitInlineEditableListRowClass =
  'flex min-h-12 flex-col gap-2 rounded-xl border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-center';

export const veitInlineEditableListScrollClass = 'max-h-56 space-y-2 overflow-y-auto pe-0.5';

export type VeitInlineEditableListStrings = {
  addRow: string;
  deleteRowSrLabel: string;
  emptyHint?: string;
};

export type VeitInlineEditableListReorderConfig<T extends { id: string | number }> = {
  getSortId: (item: T) => string | null | undefined;
  /** Nur sortierbare Zeilen (mit `getSortId` ≠ leer), neue Reihenfolge der `id`-Werte. */
  onReorder: (orderedIds: Array<T['id']>) => void;
  dragOverlay?: (item: T) => ReactNode;
  dragOverlayZIndex?: number;
};

type BaseCommon<T extends { id: string | number }> = {
  title?: ReactNode;
  surface?: 'card' | 'plain';
  titleAccessory?: ReactNode;
  items: readonly T[];
  canWrite: boolean;
  disabled?: boolean;
  error?: string | null;
  className?: string;
  listClassName?: string;
  focusRowId?: string | number | null;
  onFocusRowIdConsumed?: () => void;
  primaryInputIdPrefix?: string;
  onAddRow?: () => void;
  addButtonVariant?: 'primary' | 'muted';
  addPlacement?: 'header' | 'footer';
  /** Hinweis über Drag-and-Drop (z. B. wenn `reorder` gesetzt und mehr als eine Zeile). */
  dragHint?: string;
  reorder?: VeitInlineEditableListReorderConfig<T>;
  /** Zusätzlicher Inhalt am Ende der `<ul>` (z. B. nicht gespeicherte Zeilen); bei `reorder` nicht sortierbar. */
  ulFooter?: ReactNode;
};

type WithDelete<T extends { id: string | number }> = BaseCommon<T> & {
  strings: VeitInlineEditableListStrings;
  deleteConfirm: VeitDeleteConfirmConfig | ((item: T) => VeitDeleteConfirmConfig);
  onDeleteRow: (item: T) => void | Promise<void>;
  toggle?: {
    checked: (item: T) => boolean;
    onCheckedChange: (item: T, checked: boolean) => void;
    ariaLabel: string;
    show?: boolean;
  };
  onRowBlur?: (item: T) => void | Promise<void>;
};

export type VeitInlineEditableListTextProps<T extends { id: string | number }> = WithDelete<T> & {
  variant: 'text';
  getTitle: (item: T) => string;
  onTitleChange: (item: T, value: string) => void;
  placeholder?: string;
  inputType?: React.HTMLInputTypeAttribute;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  step?: string;
  autoComplete?: string;
};

export type VeitInlineEditableListTextToggleProps<T extends { id: string | number }> = WithDelete<T> & {
  variant: 'text-toggle';
  getTitle: (item: T) => string;
  onTitleChange: (item: T, value: string) => void;
  getChecked: (item: T) => boolean;
  onCheckedChange: (item: T, checked: boolean) => void;
  getToggleAriaLabel: (item: T) => string;
  placeholder?: string;
};

export type VeitInlineEditableListTextColorProps<T extends { id: string | number }> = WithDelete<T> & {
  variant: 'text-color';
  getTitle: (item: T) => string;
  onTitleChange: (item: T, value: string) => void;
  getHexColor: (item: T) => string | null | undefined;
  onHexChange: (item: T, value: string) => void;
  defaultHex: string;
  colorPickerAriaLabel: string;
  placeholder?: string;
};

export type VeitInlineEditableListSwatchToggleStrings = {
  emptyHint?: string;
};

/** Farbfeld + Name + Schalter (z. B. Labels einer Karte zuweisen). Ohne Löschen. */
export type VeitInlineEditableListSwatchToggleProps<T extends { id: string | number }> = BaseCommon<T> & {
  variant: 'swatch-toggle';
  strings: VeitInlineEditableListSwatchToggleStrings;
  getTitle: (item: T) => string;
  getHexColor: (item: T) => string | null | undefined;
  defaultHex: string;
  getChecked: (item: T) => boolean;
  onCheckedChange: (item: T, checked: boolean) => void;
  getToggleAriaLabel: (item: T) => string;
};

export type VeitInlineEditableListCustomRenderContext<T> = {
  item: T;
  rowId: string | number;
  disabled: boolean;
  primaryInputId: string;
  deleteControl: ReactNode | null;
  /** Griff zum Sortieren; nur gesetzt wenn `reorder` aktiv und Zeile sortierbar. */
  gripControl?: ReactNode | null;
};

export type VeitInlineEditableListCustomProps<T extends { id: string | number }> = WithDelete<T> & {
  variant: 'custom';
  renderRow: (ctx: VeitInlineEditableListCustomRenderContext<T>) => ReactNode;
  useList?: boolean;
  listRole?: 'list' | 'none';
  includeDefaultDeleteControl?: boolean;
};

export type VeitInlineListRowFrameProps = {
  /** Außen-Element; bei Sortierung mit `useSortable` typischerweise `li` mit ref. */
  as?: 'li' | 'div';
  outerRef?: Ref<HTMLLIElement | HTMLDivElement>;
  outerStyle?: CSSProperties;
  grip?: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

/** Einheitliche Zeile: optional Griff, Inhalt, Aktionen (z. B. Löschen) in einer Flex-Zeile. */
export function VeitInlineListRowFrame({
  as = 'li',
  outerRef,
  outerStyle,
  grip,
  children,
  trailing,
  className = '',
}: VeitInlineListRowFrameProps) {
  const cn = `${veitInlineEditableListRowClass} ${className}`.trim();
  const inner = (
    <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
      {grip != null ? <div className="flex shrink-0 items-start sm:items-center">{grip}</div> : null}
      <div className="min-w-0 flex-1">{children}</div>
      {trailing != null ? <div className="flex shrink-0 items-end sm:items-center">{trailing}</div> : null}
    </div>
  );
  if (as === 'div') {
    return (
      <div ref={outerRef as Ref<HTMLDivElement>} style={outerStyle} className={cn}>
        {inner}
      </div>
    );
  }
  return (
    <li ref={outerRef as Ref<HTMLLIElement>} style={outerStyle} className={cn}>
      {inner}
    </li>
  );
}

export type VeitInlineEditableListProps<T extends { id: string | number }> =
  | VeitInlineEditableListTextProps<T>
  | VeitInlineEditableListTextToggleProps<T>
  | VeitInlineEditableListTextColorProps<T>
  | VeitInlineEditableListSwatchToggleProps<T>
  | VeitInlineEditableListCustomProps<T>;

function primaryInputDomId(prefix: string, rowId: string | number) {
  return `${prefix}-${String(rowId).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function partitionBySortId<T extends { id: string | number }>(
  items: readonly T[],
  getSortId: (item: T) => string | null | undefined,
): { sortable: T[]; trailing: T[] } {
  const sortable: T[] = [];
  const trailing: T[] = [];
  for (const it of items) {
    const sid = getSortId(it);
    if (sid != null && String(sid).length > 0) sortable.push(it);
    else trailing.push(it);
  }
  return { sortable, trailing };
}

const inlineListDropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.5' } },
  }),
};

function SortableRowShellFixed({
  sortId,
  disabled,
  dragLabel,
  children,
  trailing,
}: {
  sortId: string;
  disabled: boolean;
  dragLabel: string;
  children: ReactNode;
  trailing: ReactNode;
}) {
  return (
    <VeitSortableActivatorRow
      id={sortId}
      disabled={disabled}
      draggingOpacity={0.45}
      className={veitInlineEditableListRowClass}
      renderActivator={({ setActivatorNodeRef, listeners }) => (
        <button
          ref={setActivatorNodeRef ?? undefined}
          type="button"
          className={`flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center self-end rounded-md border border-border bg-muted/40 text-muted-foreground shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08] sm:self-center ${
            disabled ? 'pointer-events-none opacity-40' : ''
          }`}
          disabled={disabled}
          aria-label={dragLabel}
          title={dragLabel}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
      )}
      trailing={trailing}
    >
      {children}
    </VeitSortableActivatorRow>
  );
}

function InlineReorderableList({
  sortableIds,
  disabled: _disabled,
  dragLabel: _dragLabel,
  dragOverlayZIndex,
  onDragEnd,
  activeSortId: _activeSortId,
  setActiveSortId,
  overlayItem,
  children,
}: {
  sortableIds: string[];
  disabled: boolean;
  dragLabel?: string;
  dragOverlayZIndex: number;
  onDragEnd: (e: DragEndEvent) => void;
  activeSortId: string | null;
  setActiveSortId: (id: string | null) => void;
  overlayItem: ReactNode;
  children: ReactNode;
}) {
  const sensors = useVeitDndSensors();
  return (
    <VeitDndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e: DragStartEvent) => setActiveSortId(String(e.active.id))}
      onDragEnd={(e: DragEndEvent) => {
        setActiveSortId(null);
        onDragEnd(e);
      }}
      onDragCancel={() => setActiveSortId(null)}
    >
      <VeitSortableRegion items={sortableIds} strategy={verticalListSortingStrategy}>
        {children}
      </VeitSortableRegion>
      {typeof document !== 'undefined'
        ? createPortal(
            <DragOverlay dropAnimation={inlineListDropAnimation} zIndex={dragOverlayZIndex}>
              {overlayItem}
            </DragOverlay>,
            document.body,
          )
        : null}
    </VeitDndContext>
  );
}

export function VeitInlineEditableList<T extends { id: string | number }>(props: VeitInlineEditableListProps<T>) {
  const {
    title,
    titleAccessory,
    items,
    canWrite,
    disabled = false,
    error,
    className = '',
    surface = 'card',
    listClassName,
    focusRowId,
    onFocusRowIdConsumed,
    primaryInputIdPrefix: prefixProp,
    onAddRow,
    addButtonVariant = 'primary',
    addPlacement: addPlacementProp,
    dragHint,
    reorder,
    ulFooter,
  } = props;

  const [activeSortId, setActiveSortId] = useState<string | null>(null);

  const reactId = useId();
  const primaryInputIdPrefix = prefixProp ?? `iel-ph-${reactId.replace(/:/g, '')}`;

  useEffect(() => {
    if (focusRowId == null) return;
    const id = primaryInputDomId(primaryInputIdPrefix, focusRowId);
    const raf = window.requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.focus();
        el.select?.();
      }
      onFocusRowIdConsumed?.();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [focusRowId, primaryInputIdPrefix, onFocusRowIdConsumed]);

  const variant = props.variant;
  const addPlacement =
    addPlacementProp ?? (variant === 'text-color' ? 'header' : variant === 'swatch-toggle' ? 'header' : 'footer');
  const showHeaderAdd =
    variant !== 'swatch-toggle' && Boolean(canWrite && onAddRow && addPlacement === 'header');
  const showFooterAdd = Boolean(canWrite && onAddRow && addPlacement === 'footer');

  const sectionClass = (surface === 'plain' ? '' : 'card ') + className.trim();

  const addBtnClass =
    addButtonVariant === 'primary'
      ? 'flex min-h-[3.25rem] w-full items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 text-primary transition hover:border-primary hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-40'
      : 'mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/15 px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/35 hover:bg-primary/[0.06] disabled:opacity-50';

  const listCn = listClassName ?? veitInlineEditableListScrollClass;

  const dragHintText = dragHint ?? '';

  const handleReorderEnd = useCallback(
    (e: DragEndEvent, sortable: T[], getSortId: (item: T) => string | null | undefined, onReorder: (ids: Array<T['id']>) => void) => {
      const { active, over } = e;
      if (!over) return;
      const aid = String(active.id);
      const oid = String(over.id);
      const ids = sortable.map((it) => getSortId(it)!);
      const oldIndex = ids.indexOf(aid);
      const newIndex = ids.indexOf(oid);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const nextItems = arrayMove(sortable, oldIndex, newIndex);
      onReorder(nextItems.map((it: T) => it.id));
    },
    [],
  );

  const reorderForOverlay =
    props.variant === 'swatch-toggle' ? undefined : (props as BaseCommon<T>).reorder;

  const activeOverlayItem = useMemo(() => {
    if (!reorderForOverlay || activeSortId == null) return null;
    const sortable = items.filter((i) => {
      const sid = reorderForOverlay.getSortId(i);
      return sid != null && String(sid).length > 0;
    });
    return sortable.find((it) => reorderForOverlay.getSortId(it) === activeSortId) ?? null;
  }, [reorderForOverlay, activeSortId, items]);

  if (props.variant === 'swatch-toggle') {
    const { strings, getTitle, getHexColor, defaultHex, getChecked, onCheckedChange, getToggleAriaLabel } = props;
    const empty = items.length === 0 && strings.emptyHint != null && strings.emptyHint !== '';

    const showHeading = title != null || titleAccessory != null;

    return (
      <section className={sectionClass.trim()}>
        {showHeading ? (
          <div className="mb-2 flex items-center justify-between gap-2">
            {title != null ? <h2 className="heading-2 min-w-0">{title}</h2> : <div className="min-w-0 flex-1" />}
            <div className="flex shrink-0 items-center gap-2">{titleAccessory}</div>
          </div>
        ) : null}
        {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}
        {empty ? (
          <p className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-3 py-6 text-center text-sm text-muted-foreground">
            {strings.emptyHint}
          </p>
        ) : (
          <ul className={listCn}>
            {items.map((item) => {
              const rowId = item.id;
              const hex = getHexColor(item) || defaultHex;
              const checked = getChecked(item);
              return (
                <li key={String(rowId)} className={veitInlineEditableListRowClass}>
                  <div className="flex w-full min-w-0 items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span
                        className="h-10 w-10 shrink-0 rounded-lg border border-border shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]"
                        style={{ backgroundColor: hex }}
                        title={hex}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{getTitle(item)}</span>
                    </div>
                    <VeitSwitch
                      className="shrink-0"
                      checked={checked}
                      disabled={disabled || !canWrite}
                      onCheckedChange={(c) => onCheckedChange(item, c)}
                      aria-label={getToggleAriaLabel(item)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  const {
    strings,
    deleteConfirm,
    onDeleteRow,
    toggle,
    onRowBlur,
  } = props as WithDelete<T>;

  const toggleVisible = toggle == null || toggle.show !== false;

  const resolveDeleteCfg = (item: T) =>
    typeof deleteConfirm === 'function' ? deleteConfirm(item) : deleteConfirm;

  const deleteBtn = (item: T) => (
    <VeitDeleteButton
      className="h-9 w-9 shrink-0 self-end p-0 sm:self-center"
      disabled={disabled || !canWrite}
      deleteConfirm={resolveDeleteCfg(item)}
      onClick={() => void Promise.resolve(onDeleteRow(item))}
    >
      <span className="sr-only">{strings.deleteRowSrLabel}</span>
    </VeitDeleteButton>
  );

  const empty = items.length === 0 && strings.emptyHint != null && strings.emptyHint !== '';

  const headerAddBtnNode =
    showHeaderAdd ? (
      <button
        type="button"
        onClick={() => onAddRow?.()}
        disabled={disabled}
        className="btn-secondary inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg p-0 touch-manipulation"
        aria-label={strings.addRow}
        title={strings.addRow}
      >
        <Plus className="h-4 w-4 shrink-0" aria-hidden />
      </button>
    ) : null;

  const footerAddBtnNode = showFooterAdd ? (
    <button
      type="button"
      className={
        addBtnClass + (addButtonVariant === 'muted' || variant === 'custom' || variant === 'text-toggle' ? '' : ' mt-3')
      }
      disabled={disabled}
      aria-label={strings.addRow}
      title={strings.addRow}
      onClick={() => onAddRow?.()}
    >
      <Plus className={addButtonVariant === 'primary' ? 'h-7 w-7 stroke-[2]' : 'h-4 w-4 shrink-0'} aria-hidden />
      {addButtonVariant === 'muted' ? <span>{strings.addRow}</span> : null}
    </button>
  ) : null;

  const showDragHint = Boolean(reorder && dragHintText && items.filter((i) => reorder.getSortId(i)).length > 1);

  if (props.variant === 'custom') {
    const { renderRow, useList = true, listRole, includeDefaultDeleteControl = true } = props;
    const { sortable, trailing } = reorder
      ? partitionBySortId(items, reorder.getSortId)
      : { sortable: [] as T[], trailing: [...items] };

    const sortableIds = reorder ? sortable.map((it) => reorder.getSortId(it)!) : [];

    const renderTrailingRows = () =>
      trailing.map((item) => {
        const rowId = item.id;
        const ctx: VeitInlineEditableListCustomRenderContext<T> = {
          item,
          rowId,
          disabled: disabled || !canWrite,
          primaryInputId: primaryInputDomId(primaryInputIdPrefix, rowId),
          deleteControl: includeDefaultDeleteControl ? deleteBtn(item) : null,
          gripControl: null,
        };
        return (
          <Fragment key={String(rowId)}>
            {useList ? (
              <li className={veitInlineEditableListRowClass}>{renderRow(ctx)}</li>
            ) : (
              renderRow(ctx)
            )}
          </Fragment>
        );
      });

    const renderSortableRows = () =>
      sortable.map((item) => {
        const rowId = item.id;
        const sid = reorder!.getSortId(item)!;
        const ctx: VeitInlineEditableListCustomRenderContext<T> = {
          item,
          rowId,
          disabled: disabled || !canWrite,
          primaryInputId: primaryInputDomId(primaryInputIdPrefix, rowId),
          deleteControl: includeDefaultDeleteControl ? deleteBtn(item) : null,
          gripControl: null,
        };
        return (
          <SortableRowShellFixed
            key={String(rowId)}
            sortId={sid}
            disabled={disabled || !canWrite}
            dragLabel={dragHintText || strings.addRow}
            trailing={includeDefaultDeleteControl ? deleteBtn(item) : <span className="w-9 shrink-0" />}
          >
            {renderRow(ctx)}
          </SortableRowShellFixed>
        );
      });

    const overlay =
      reorder && activeOverlayItem ? (
        <div className="flex max-w-md items-center gap-2 rounded-xl border border-primary/30 bg-card px-3 py-2 text-sm shadow-lg">
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">
            {reorder.dragOverlay ? reorder.dragOverlay(activeOverlayItem) : String(activeOverlayItem.id)}
          </span>
        </div>
      ) : null;

    const listInner = reorder ? (
      <>
        {renderSortableRows()}
        {renderTrailingRows()}
      </>
    ) : (
      items.map((item) => {
        const rowId = item.id;
        const ctx: VeitInlineEditableListCustomRenderContext<T> = {
          item,
          rowId,
          disabled: disabled || !canWrite,
          primaryInputId: primaryInputDomId(primaryInputIdPrefix, rowId),
          deleteControl: includeDefaultDeleteControl ? deleteBtn(item) : null,
          gripControl: null,
        };
        return (
          <Fragment key={String(rowId)}>
            {renderRow(ctx)}
          </Fragment>
        );
      })
    );

    const showHeadingCustom = title != null || titleAccessory != null || headerAddBtnNode != null;

    const listBody = empty ? null : reorder ? (
      <InlineReorderableList
        sortableIds={sortableIds}
        disabled={disabled || !canWrite}
        dragLabel={dragHintText || strings.addRow}
        dragOverlayZIndex={reorder.dragOverlayZIndex ?? 320}
        activeSortId={activeSortId}
        setActiveSortId={setActiveSortId}
        overlayItem={overlay}
        onDragEnd={(e) => handleReorderEnd(e, sortable, reorder.getSortId, reorder.onReorder)}
      >
        <ul className={listCn} role={listRole === 'none' ? 'none' : undefined}>
          {listInner}
          {ulFooter}
        </ul>
      </InlineReorderableList>
    ) : useList ? (
      <ul className={listCn} role={listRole === 'none' ? 'none' : undefined}>
        {listInner}
        {ulFooter}
      </ul>
    ) : (
      <div className={listCn} role={listRole === 'none' ? undefined : 'list'}>
        {listInner}
        {ulFooter}
      </div>
    );

    return (
      <section className={sectionClass.trim()}>
        {showHeadingCustom ? (
          <div className="mb-2 flex items-center justify-between gap-2">
            {title != null ? <h2 className="heading-2 min-w-0">{title}</h2> : <div className="min-w-0 flex-1" />}
            <div className="flex shrink-0 items-center gap-2">
              {titleAccessory}
              {headerAddBtnNode}
            </div>
          </div>
        ) : null}
        {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}
        {showDragHint ? <p className="mb-2 text-xs text-muted-foreground">{dragHintText}</p> : null}
        {empty ? (
          <p className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-3 py-6 text-center text-sm text-muted-foreground">
            {strings.emptyHint}
          </p>
        ) : (
          listBody
        )}
        {footerAddBtnNode}
      </section>
    );
  }

  if (props.variant === 'text-color') {
    const { getTitle, onTitleChange, getHexColor, onHexChange, defaultHex, colorPickerAriaLabel, placeholder } = props;
    const { sortable, trailing } = reorder
      ? partitionBySortId(items, reorder.getSortId)
      : { sortable: [] as T[], trailing: [...items] };
    const sortableIds = reorder ? sortable.map((it) => reorder.getSortId(it)!) : [];
    const showHeading = title != null || titleAccessory != null || headerAddBtnNode != null;

    const rowContent = (item: T, sortId: string | null) => {
      const rowId = item.id;
      const pid = primaryInputDomId(primaryInputIdPrefix, rowId);
      const hex = getHexColor(item) || defaultHex;
      const inner = (
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          {toggleVisible && toggle ? (
            <VeitSwitch
              className="shrink-0"
              checked={toggle.checked(item)}
              disabled={disabled || !canWrite}
              onCheckedChange={(c) => toggle.onCheckedChange(item, c)}
              aria-label={toggle.ariaLabel}
            />
          ) : null}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
              type="color"
              value={hex}
              onChange={(e) => onHexChange(item, e.target.value)}
              onBlur={() => void Promise.resolve(onRowBlur?.(item))}
              disabled={disabled || !canWrite}
              className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-input bg-background p-0.5 shadow-sm touch-manipulation"
              aria-label={colorPickerAriaLabel}
              title={colorPickerAriaLabel}
            />
            <input
              id={pid}
              className="input min-h-10 min-w-0 flex-1 text-sm"
              value={getTitle(item)}
              onChange={(e) => onTitleChange(item, e.target.value)}
              onBlur={() => void Promise.resolve(onRowBlur?.(item))}
              placeholder={placeholder}
              autoComplete="off"
              disabled={disabled || !canWrite}
            />
          </div>
        </div>
      );
      if (sortId != null && reorder) {
        return (
          <SortableRowShellFixed
            key={String(rowId)}
            sortId={sortId}
            disabled={disabled || !canWrite}
            dragLabel={dragHintText || strings.addRow}
            trailing={deleteBtn(item)}
          >
            {inner}
          </SortableRowShellFixed>
        );
      }
      return (
        <VeitInlineListRowFrame key={String(rowId)} trailing={deleteBtn(item)}>
          {inner}
        </VeitInlineListRowFrame>
      );
    };

    const overlay =
      reorder && activeOverlayItem ? (
        <div className="flex max-w-md items-center gap-2 rounded-xl border border-primary/30 bg-card px-3 py-2 text-sm shadow-lg">
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">
            {reorder.dragOverlay ? reorder.dragOverlay(activeOverlayItem) : getTitle(activeOverlayItem)}
          </span>
        </div>
      ) : null;

    const ulBody = reorder ? (
      <InlineReorderableList
        sortableIds={sortableIds}
        disabled={disabled || !canWrite}
        dragLabel={dragHintText || strings.addRow}
        dragOverlayZIndex={reorder.dragOverlayZIndex ?? 320}
        activeSortId={activeSortId}
        setActiveSortId={setActiveSortId}
        overlayItem={overlay}
        onDragEnd={(e) => handleReorderEnd(e, sortable, reorder.getSortId, reorder.onReorder)}
      >
        <ul className={listCn}>
          {sortable.map((item) => rowContent(item, reorder.getSortId(item)!))}
          {trailing.map((item) => rowContent(item, null))}
          {ulFooter}
        </ul>
      </InlineReorderableList>
    ) : (
      <ul className={listCn}>
        {items.map((item) => rowContent(item, null))}
        {ulFooter}
      </ul>
    );

    return (
      <section className={sectionClass.trim()}>
        {showHeading ? (
          <div className="mb-2 flex items-center justify-between gap-2">
            {title != null ? <h2 className="heading-2 min-w-0">{title}</h2> : <div className="min-w-0 flex-1" />}
            <div className="flex shrink-0 items-center gap-2">
              {titleAccessory}
              {headerAddBtnNode}
            </div>
          </div>
        ) : null}
        {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}
        {showDragHint ? <p className="mb-2 text-xs text-muted-foreground">{dragHintText}</p> : null}
        {empty ? (
          <p className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-3 py-6 text-center text-sm text-muted-foreground">
            {strings.emptyHint}
          </p>
        ) : (
          ulBody
        )}
        {footerAddBtnNode}
      </section>
    );
  }

  if (props.variant === 'text-toggle') {
    const { getTitle, onTitleChange, getChecked, onCheckedChange, getToggleAriaLabel, placeholder } = props;
    const { sortable, trailing } = reorder
      ? partitionBySortId(items, reorder.getSortId)
      : { sortable: [] as T[], trailing: [...items] };
    const sortableIds = reorder ? sortable.map((it) => reorder.getSortId(it)!) : [];
    const showHeading = title != null || titleAccessory != null || headerAddBtnNode != null;

    const rowContent = (item: T, sortId: string | null) => {
      const rowId = item.id;
      const pid = primaryInputDomId(primaryInputIdPrefix, rowId);
      const inner = (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <VeitSwitch
            className="shrink-0"
            checked={getChecked(item)}
            disabled={disabled || !canWrite}
            onCheckedChange={(c) => onCheckedChange(item, c)}
            aria-label={getToggleAriaLabel(item)}
          />
          <input
            id={pid}
            type="text"
            className="input min-h-10 min-w-0 flex-1 text-sm"
            value={getTitle(item)}
            onChange={(e) => onTitleChange(item, e.target.value)}
            onBlur={() => void Promise.resolve(onRowBlur?.(item))}
            placeholder={placeholder}
            autoComplete="off"
            disabled={disabled || !canWrite}
          />
        </div>
      );
      if (sortId != null && reorder) {
        return (
          <SortableRowShellFixed
            key={String(rowId)}
            sortId={sortId}
            disabled={disabled || !canWrite}
            dragLabel={dragHintText || strings.addRow}
            trailing={deleteBtn(item)}
          >
            {inner}
          </SortableRowShellFixed>
        );
      }
      return (
        <VeitInlineListRowFrame key={String(rowId)} trailing={deleteBtn(item)}>
          {inner}
        </VeitInlineListRowFrame>
      );
    };

    const overlay =
      reorder && activeOverlayItem ? (
        <div className="flex max-w-md items-center gap-2 rounded-xl border border-primary/30 bg-card px-3 py-2 text-sm shadow-lg">
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">
            {reorder.dragOverlay ? reorder.dragOverlay(activeOverlayItem) : getTitle(activeOverlayItem)}
          </span>
        </div>
      ) : null;

    const ulBody = reorder ? (
      <InlineReorderableList
        sortableIds={sortableIds}
        disabled={disabled || !canWrite}
        dragLabel={dragHintText || strings.addRow}
        dragOverlayZIndex={reorder.dragOverlayZIndex ?? 320}
        activeSortId={activeSortId}
        setActiveSortId={setActiveSortId}
        overlayItem={overlay}
        onDragEnd={(e) => handleReorderEnd(e, sortable, reorder.getSortId, reorder.onReorder)}
      >
        <ul className={listCn}>
          {sortable.map((item) => rowContent(item, reorder.getSortId(item)!))}
          {trailing.map((item) => rowContent(item, null))}
          {ulFooter}
        </ul>
      </InlineReorderableList>
    ) : (
      <ul className={listCn}>
        {items.map((item) => rowContent(item, null))}
        {ulFooter}
      </ul>
    );

    return (
      <section className={sectionClass.trim()}>
        {showHeading ? (
          <div className="mb-2 flex items-center justify-between gap-2">
            {title != null ? <h2 className="heading-2 min-w-0">{title}</h2> : <div className="min-w-0 flex-1" />}
            <div className="flex shrink-0 items-center gap-2">
              {titleAccessory}
              {headerAddBtnNode}
            </div>
          </div>
        ) : null}
        {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}
        {showDragHint ? <p className="mb-2 text-xs text-muted-foreground">{dragHintText}</p> : null}
        {empty ? (
          <p className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-3 py-6 text-center text-sm text-muted-foreground">
            {strings.emptyHint}
          </p>
        ) : (
          ulBody
        )}
        {footerAddBtnNode}
      </section>
    );
  }

  const { getTitle, onTitleChange, placeholder, inputType = 'text', inputMode, step, autoComplete } = props;
  const { sortable, trailing } = reorder
    ? partitionBySortId(items, reorder.getSortId)
    : { sortable: [] as T[], trailing: [...items] };
  const sortableIds = reorder ? sortable.map((it) => reorder.getSortId(it)!) : [];
  const showHeading = title != null || titleAccessory != null || headerAddBtnNode != null;

  const rowContent = (item: T, sortId: string | null) => {
    const rowId = item.id;
    const pid = primaryInputDomId(primaryInputIdPrefix, rowId);
    const inner = (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {toggleVisible && toggle ? (
          <VeitSwitch
            className="shrink-0"
            checked={toggle.checked(item)}
            disabled={disabled || !canWrite}
            onCheckedChange={(c) => toggle.onCheckedChange(item, c)}
            aria-label={toggle.ariaLabel}
          />
        ) : null}
        <input
          id={pid}
          type={inputType}
          inputMode={inputMode}
          step={step}
          autoComplete={autoComplete}
          className="input min-h-10 w-full flex-1 text-sm"
          value={getTitle(item)}
          onChange={(e) => onTitleChange(item, e.target.value)}
          onBlur={() => void Promise.resolve(onRowBlur?.(item))}
          placeholder={placeholder}
          disabled={disabled || !canWrite}
        />
      </div>
    );
    if (sortId != null && reorder) {
      return (
        <SortableRowShellFixed
          key={String(rowId)}
          sortId={sortId}
          disabled={disabled || !canWrite}
          dragLabel={dragHintText || strings.addRow}
          trailing={deleteBtn(item)}
        >
          {inner}
        </SortableRowShellFixed>
      );
    }
    return (
      <VeitInlineListRowFrame key={String(rowId)} trailing={deleteBtn(item)}>
        {inner}
      </VeitInlineListRowFrame>
    );
  };

  const overlay =
    reorder && activeOverlayItem ? (
      <div className="flex max-w-md items-center gap-2 rounded-xl border border-primary/30 bg-card px-3 py-2 text-sm shadow-lg">
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">
          {reorder.dragOverlay ? reorder.dragOverlay(activeOverlayItem) : getTitle(activeOverlayItem)}
        </span>
      </div>
    ) : null;

  const ulBody = reorder ? (
    <InlineReorderableList
      sortableIds={sortableIds}
      disabled={disabled || !canWrite}
      dragLabel={dragHintText || strings.addRow}
      dragOverlayZIndex={reorder.dragOverlayZIndex ?? 320}
      activeSortId={activeSortId}
      setActiveSortId={setActiveSortId}
      overlayItem={overlay}
      onDragEnd={(e) => handleReorderEnd(e, sortable, reorder.getSortId, reorder.onReorder)}
    >
      <ul className={listCn}>
        {sortable.map((item) => rowContent(item, reorder.getSortId(item)!))}
        {trailing.map((item) => rowContent(item, null))}
        {ulFooter}
      </ul>
    </InlineReorderableList>
  ) : (
    <ul className={listCn}>
      {items.map((item) => rowContent(item, null))}
      {ulFooter}
    </ul>
  );

  return (
    <section className={sectionClass.trim()}>
      {showHeading ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          {title != null ? <h2 className="heading-2 min-w-0">{title}</h2> : <div className="min-w-0 flex-1" />}
          <div className="flex shrink-0 items-center gap-2">
            {titleAccessory}
            {headerAddBtnNode}
          </div>
        </div>
      ) : null}
      {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}
      {showDragHint ? <p className="mb-2 text-xs text-muted-foreground">{dragHintText}</p> : null}
      {empty ? (
        <p className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-3 py-6 text-center text-sm text-muted-foreground">
          {strings.emptyHint}
        </p>
      ) : (
        ulBody
      )}
      {footerAddBtnNode}
    </section>
  );
}

export function veitInlineEditableListPrimaryInputId(prefix: string, rowId: string | number) {
  return primaryInputDomId(prefix, rowId);
}

export function useVeitInlineEditableListPrimaryIdPrefix(): string {
  const id = useId();
  return useMemo(() => `iel-ph-${id.replace(/:/g, '')}`, [id]);
}
