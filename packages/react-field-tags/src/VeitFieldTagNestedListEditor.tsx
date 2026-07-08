import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { GripVertical, Plus } from 'lucide-react';
import {
  buildTagChildrenMap,
  buildTagColorIndexMap,
  canMoveTagToParent,
  parseTagParentZoneId,
  parseTagSortId,
  planTagTreeMove,
  tagColorHexForIndex,
  tagParentZoneId,
  tagSortId,
  tagTreeMoveUnchanged,
  type FieldTag,
} from '@veit/field-tags';
import { VeitDeleteButton, VeitInlineListRowFrame, veitInlineEditableListRowClass } from '@veit/react-controls';
import {
  type DragEndEvent,
  useVeitDndSensors,
  VeitDndContext,
  VeitDroppableZone,
  VeitSortableActivatorRow,
  VeitSortableRegion,
  verticalListSortingStrategy,
} from '@veit/react-dnd';
import type { VeitDeleteConfirmConfig } from '@veit/react-dialog';

import { allocNestedTempTagId, type NestedTagDraft, type VeitFieldTagListStrings } from './types.js';

/** Gleiche Optik wie „Hinzufügen“-Zeile in `VeitInlineEditableList` (variant text-color, footer). */
const rootAddButtonClass =
  'flex min-h-[3.25rem] w-full items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 text-primary transition hover:border-primary hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-40';

type NestedTreeProps = {
  fieldId: number;
  rows: NestedTagDraft[];
  onRowsChange: (rows: NestedTagDraft[]) => void;
  disabled?: boolean;
  defaultHex?: string;
  strings: VeitFieldTagListStrings;
  deleteConfirm: (item: NestedTagDraft) => VeitDeleteConfirmConfig;
  deleteButtonClassName?: string;
  deleteButtonLabel: ReactNode;
};

function applySiblingOrder(
  rows: NestedTagDraft[],
  parentId: number | null,
  orderedIds: number[],
): NestedTagDraft[] {
  const idSet = new Set(orderedIds);
  return rows.map((row) => {
    const rowParent = row.parent_id ?? null;
    if (rowParent !== parentId || !idSet.has(row.id)) return row;
    const sort_order = orderedIds.indexOf(row.id);
    return sort_order < 0 ? row : { ...row, sort_order };
  });
}

function resolveFieldId(rows: NestedTagDraft[], fieldId: number): number {
  return rows[0]?.field_id ?? fieldId;
}

function NestedTagRow({
  tag,
  colorIndex,
  sortDisabled,
  strings,
  deleteConfirm,
  deleteButtonClassName,
  deleteButtonLabel,
  onRename,
  onColorChange,
  onDelete,
  onAddChild,
}: {
  tag: FieldTag;
  colorIndex: number;
  sortDisabled: boolean;
  strings: VeitFieldTagListStrings;
  deleteConfirm: (item: NestedTagDraft) => VeitDeleteConfirmConfig;
  deleteButtonClassName?: string;
  deleteButtonLabel: ReactNode;
  onRename: (tagId: number, name: string) => void;
  onColorChange: (tagId: number, hexColor: string) => void;
  onDelete: (tagId: number) => void;
  onAddChild: (tagId: number) => void;
}) {
  const hex = tag.hex_color?.trim() || tagColorHexForIndex(colorIndex);
  const deleteBtn = (
    <VeitDeleteButton
      className={deleteButtonClassName ?? 'h-9 w-9 shrink-0 self-end p-0 sm:self-center'}
      disabled={sortDisabled}
      deleteConfirm={deleteConfirm(tag)}
      onClick={() => onDelete(tag.id)}
    >
      {deleteButtonLabel}
    </VeitDeleteButton>
  );

  const rowFields = (
    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <input
          type="color"
          value={hex}
          disabled={sortDisabled}
          className="h-10 w-10 shrink-0 cursor-pointer rounded-input border border-input/85 bg-surface/90 p-0.5 shadow-sm touch-manipulation"
          aria-label={strings.labelColor}
          title={strings.labelColor}
          onChange={(e) => onColorChange(tag.id, e.target.value)}
        />
        <input
          className="input min-h-10 min-w-0 flex-1 text-sm"
          value={tag.name}
          disabled={sortDisabled}
          placeholder={strings.namePlaceholder}
          autoComplete="off"
          onChange={(e) => onRename(tag.id, e.target.value)}
        />
      </div>
    </div>
  );

  return (
    <VeitSortableActivatorRow
      id={tagSortId(tag.id)}
      as="div"
      disabled={sortDisabled}
      draggingOpacity={0.45}
      className={veitInlineEditableListRowClass}
      renderActivator={({ setActivatorNodeRef, listeners }) => (
        <button
          ref={setActivatorNodeRef ?? undefined}
          type="button"
          className={`flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center self-end rounded-md border border-border bg-muted/40 text-muted-foreground shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08] sm:self-center ${
            sortDisabled ? 'pointer-events-none opacity-40' : ''
          }`}
          disabled={sortDisabled}
          aria-label={strings.tagDragReorder}
          title={strings.tagDragReorder}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
      )}
      trailing={
        <div className="flex shrink-0 items-end gap-1 sm:items-center">
          <button
            type="button"
            className="btn-secondary min-h-9 px-2.5 text-xs"
            disabled={sortDisabled}
            onClick={() => onAddChild(tag.id)}
          >
            {strings.tagAddChild}
          </button>
          {deleteBtn}
        </div>
      }
    >
      {rowFields}
    </VeitSortableActivatorRow>
  );
}

function TagSiblingList({
  byParent,
  parentId,
  depth,
  fieldId,
  rows,
  onRowsChange,
  disabled,
  defaultHex,
  dndBusy,
  activeDragId,
  dragOverZoneId,
  strings,
  deleteConfirm,
  deleteButtonClassName,
  deleteButtonLabel,
}: {
  byParent: Map<number | null, FieldTag[]>;
  parentId: number | null;
  depth: number;
  fieldId: number;
  rows: NestedTagDraft[];
  onRowsChange: (rows: NestedTagDraft[]) => void;
  disabled?: boolean;
  defaultHex?: string;
  dndBusy: boolean;
  activeDragId: number | null;
  dragOverZoneId: string | null;
  strings: VeitFieldTagListStrings;
  deleteConfirm: (item: NestedTagDraft) => VeitDeleteConfirmConfig;
  deleteButtonClassName?: string;
  deleteButtonLabel: ReactNode;
}) {
  const nodes = byParent.get(parentId) ?? [];
  const colorIndexById = useMemo(() => buildTagColorIndexMap(rows), [rows]);
  const [addingUnder, setAddingUnder] = useState<number | 'root' | null>(null);
  const [newName, setNewName] = useState('');
  const sortIds = useMemo(() => nodes.map((tag) => tagSortId(tag.id)), [nodes]);
  const zoneId = tagParentZoneId(parentId);
  const sortDisabled = disabled || dndBusy;
  const dropActive =
    dragOverZoneId === zoneId &&
    activeDragId != null &&
    canMoveTagToParent(rows, activeDragId, parentId);
  const effectiveFieldId = resolveFieldId(rows, fieldId);

  const submitNew = (parent: number | null) => {
    const name = newName.trim();
    if (!name) return;
    const siblings = rows.filter((t) => (t.parent_id ?? null) === parent);
    const id = allocNestedTempTagId(rows);
    onRowsChange([
      ...rows,
      {
        id,
        field_id: effectiveFieldId,
        parent_id: parent,
        name,
        sort_order: siblings.length,
        hex_color: tagColorHexForIndex(rows.length + 1),
      },
    ]);
    setNewName('');
    setAddingUnder(null);
  };

  const renameTag = (tagId: number, name: string) => {
    onRowsChange(rows.map((t) => (t.id === tagId ? { ...t, name } : t)));
  };

  const updateTagColor = (tagId: number, hexColor: string) => {
    onRowsChange(rows.map((t) => (t.id === tagId ? { ...t, hex_color: hexColor } : t)));
  };

  const deleteTag = (tagId: number) => {
    const removeIds = new Set<number>();
    const collect = (id: number) => {
      removeIds.add(id);
      for (const child of rows.filter((t) => t.parent_id === id)) collect(child.id);
    };
    collect(tagId);
    onRowsChange(rows.filter((t) => !removeIds.has(t.id)));
  };

  const addChildForm = (parent: number | null) => (
    <VeitInlineListRowFrame
      as="li"
      trailing={
        <button
          type="button"
          className="btn-primary min-h-9 px-3 text-xs"
          disabled={sortDisabled}
          onClick={() => submitNew(parent)}
        >
          {strings.addButton}
        </button>
      }
    >
      <input
        className="input min-h-10 min-w-0 flex-1 text-sm"
        value={newName}
        disabled={sortDisabled}
        placeholder={strings.tagNamePlaceholder}
        autoComplete="off"
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submitNew(parent);
          if (e.key === 'Escape') setAddingUnder(null);
        }}
      />
    </VeitInlineListRowFrame>
  );

  return (
    <VeitSortableRegion items={sortIds} strategy={verticalListSortingStrategy}>
      <VeitDroppableZone
        id={zoneId}
        className={`transition-colors ${
          depth === 0 ? 'space-y-2' : 'ms-2 mt-1 min-h-6 space-y-2 border-s border-border/30 ps-3'
        } ${dropActive ? 'rounded-lg bg-primary/5' : ''}`}
        isOverClassName=""
      >
        <ul className="space-y-2">
          {nodes.map((tag) => (
            <li key={tag.id} className="space-y-2">
              <NestedTagRow
                tag={tag}
                colorIndex={colorIndexById.get(tag.id) ?? 1}
                sortDisabled={sortDisabled}
                strings={strings}
                deleteConfirm={deleteConfirm}
                deleteButtonClassName={deleteButtonClassName}
                deleteButtonLabel={deleteButtonLabel}
                onRename={renameTag}
                onColorChange={updateTagColor}
                onDelete={deleteTag}
                onAddChild={(tagId) => {
                  setAddingUnder(tagId);
                  setNewName('');
                }}
              />
              {addingUnder === tag.id ? addChildForm(tag.id) : null}
              <TagSiblingList
                byParent={byParent}
                parentId={tag.id}
                depth={depth + 1}
                fieldId={fieldId}
                rows={rows}
                onRowsChange={onRowsChange}
                disabled={disabled}
                defaultHex={defaultHex}
                dndBusy={dndBusy}
                activeDragId={activeDragId}
                dragOverZoneId={dragOverZoneId}
                strings={strings}
                deleteConfirm={deleteConfirm}
                deleteButtonClassName={deleteButtonClassName}
                deleteButtonLabel={deleteButtonLabel}
              />
            </li>
          ))}
          {depth === 0 && addingUnder === 'root' ? addChildForm(null) : null}
          {depth === 0 ? (
            <li>
              <button
                type="button"
                className={rootAddButtonClass}
                disabled={sortDisabled}
                aria-label={strings.tagAddRoot}
                title={strings.tagAddRoot}
                onClick={() => {
                  setAddingUnder('root');
                  setNewName('');
                }}
              >
                <Plus className="h-7 w-7 stroke-[2]" aria-hidden />
              </button>
            </li>
          ) : null}
          {nodes.length === 0 && depth > 0 ? (
            <li className="py-1 ps-1 text-xs text-muted-foreground">{strings.tagDropChildHint}</li>
          ) : null}
        </ul>
      </VeitDroppableZone>
    </VeitSortableRegion>
  );
}

export function VeitFieldTagNestedListEditor({
  fieldId,
  rows,
  onRowsChange,
  disabled,
  defaultHex,
  strings,
  deleteConfirm,
  deleteButtonClassName,
  deleteButtonLabel,
}: NestedTreeProps) {
  const [dndBusy, setDndBusy] = useState(false);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [dragOverZoneId, setDragOverZoneId] = useState<string | null>(null);
  const sensors = useVeitDndSensors();
  const byParent = useMemo(() => buildTagChildrenMap(rows), [rows]);

  const resolveDragOverZone = useCallback(
    (overId: string | null): string | null => {
      if (!overId) return null;
      const zoneParent = parseTagParentZoneId(overId);
      if (zoneParent !== undefined) return overId;
      const overTagId = parseTagSortId(overId);
      if (overTagId == null) return null;
      const overTag = rows.find((tag) => tag.id === overTagId);
      return overTag ? tagParentZoneId(overTag.parent_id) : null;
    },
    [rows],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragId(null);
      setDragOverZoneId(null);
      if (!over || disabled || dndBusy) return;

      const plan = planTagTreeMove(String(active.id), String(over.id), rows, byParent);
      if (!plan) return;
      const tag = rows.find((row) => row.id === plan.tagId);
      if (!tag || tagTreeMoveUnchanged(tag, plan, byParent)) return;

      setDndBusy(true);
      try {
        let next = rows.map((row) =>
          row.id === plan.tagId ? { ...row, parent_id: plan.parentId } : row,
        );
        next = applySiblingOrder(next, plan.parentId, plan.orderedSiblingIds);
        onRowsChange(next);
      } finally {
        setDndBusy(false);
      }
    },
    [byParent, disabled, dndBusy, onRowsChange, rows],
  );

  return (
    <VeitDndContext
      sensors={sensors}
      onDragStart={(e) => setActiveDragId(parseTagSortId(String(e.active.id)))}
      onDragOver={(e) => setDragOverZoneId(resolveDragOverZone(e.over ? String(e.over.id) : null))}
      onDragCancel={() => {
        setActiveDragId(null);
        setDragOverZoneId(null);
      }}
      onDragEnd={(e) => handleDragEnd(e)}
    >
      <TagSiblingList
        byParent={byParent}
        parentId={null}
        depth={0}
        fieldId={fieldId}
        rows={rows}
        onRowsChange={onRowsChange}
        disabled={disabled}
        defaultHex={defaultHex}
        dndBusy={dndBusy}
        activeDragId={activeDragId}
        dragOverZoneId={dragOverZoneId}
        strings={strings}
        deleteConfirm={deleteConfirm}
        deleteButtonClassName={deleteButtonClassName}
        deleteButtonLabel={deleteButtonLabel}
      />
    </VeitDndContext>
  );
}
