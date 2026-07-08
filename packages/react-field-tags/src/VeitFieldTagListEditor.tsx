import { useCallback, useMemo } from 'react';
import type { VeitDeleteConfirmConfig } from '@veit/react-dialog';
import { tagColorHexForIndex } from '@veit/field-tags';
import { useVeitInlineEditableListPrimaryIdPrefix, VeitInlineEditableList } from '@veit/react-controls';

import {
  type FlatTagDraft,
  type NestedTagDraft,
  type VeitFieldTagListStrings,
} from './types.js';
import { VeitFieldTagNestedListEditor } from './VeitFieldTagNestedListEditor.js';

export type VeitFieldTagListEditorProps =
  | {
      mode?: 'flat';
      fieldId?: never;
      items: FlatTagDraft[];
      onItemsChange: (items: FlatTagDraft[]) => void;
      canWrite?: boolean;
      disabled?: boolean;
      defaultHex: string;
      strings: VeitFieldTagListStrings;
      confirmZIndexBase?: number;
      focusRowId?: string | number | null;
      onFocusRowIdConsumed?: () => void;
      deleteConfirm: (item: FlatTagDraft) => VeitDeleteConfirmConfig;
      listClassName?: string;
    }
  | {
      mode: 'nested';
      fieldId: number;
      items: NestedTagDraft[];
      onItemsChange: (items: NestedTagDraft[]) => void;
      disabled?: boolean;
      defaultHex?: string;
      strings: VeitFieldTagListStrings;
      deleteConfirm: (item: NestedTagDraft) => VeitDeleteConfirmConfig;
      deleteButtonClassName?: string;
      deleteButtonLabel: React.ReactNode;
    };

export function VeitFieldTagListEditor(props: VeitFieldTagListEditorProps) {
  if (props.mode === 'nested') {
    return (
      <VeitFieldTagNestedListEditor
        fieldId={props.fieldId}
        rows={props.items}
        onRowsChange={props.onItemsChange}
        disabled={props.disabled}
        defaultHex={props.defaultHex}
        strings={props.strings}
        deleteConfirm={props.deleteConfirm}
        deleteButtonClassName={props.deleteButtonClassName}
        deleteButtonLabel={props.deleteButtonLabel}
      />
    );
  }

  return <VeitFieldTagFlatListEditor {...props} />;
}

function VeitFieldTagFlatListEditor({
  items,
  onItemsChange,
  canWrite = true,
  disabled,
  defaultHex,
  strings,
  confirmZIndexBase = 250,
  focusRowId,
  onFocusRowIdConsumed,
  deleteConfirm,
  listClassName = 'max-h-[min(40dvh,22rem)] space-y-2 overflow-y-auto pe-0.5',
}: Extract<VeitFieldTagListEditorProps, { mode?: 'flat' }>) {
  const primaryInputIdPrefix = useVeitInlineEditableListPrimaryIdPrefix();

  const onDeleteRow = useCallback(
    (item: FlatTagDraft) => {
      onItemsChange(items.filter((x) => x.id !== item.id));
    },
    [items, onItemsChange],
  );

  const onReorderRows = useCallback(
    (orderedIds: Array<FlatTagDraft['id']>) => {
      onItemsChange((() => {
        const byKey = new Map(items.map((x) => [String(x.id), x]));
        const next: FlatTagDraft[] = [];
        for (const rid of orderedIds) {
          const r = byKey.get(String(rid));
          if (r) next.push(r);
        }
        for (const r of items) {
          if (!next.some((x) => String(x.id) === String(r.id))) next.push(r);
        }
        return next;
      })());
    },
    [items, onItemsChange],
  );

  const reorder = useMemo(
    () =>
      items.length > 1
        ? {
            getSortId: (item: FlatTagDraft) => String(item.id),
            onReorder: (ids: Array<string | number>) => onReorderRows(ids as Array<FlatTagDraft['id']>),
            dragOverlay: (item: FlatTagDraft) => <span className="truncate">{item.name}</span>,
            dragOverlayZIndex: Math.max(confirmZIndexBase + 55, 320),
          }
        : undefined,
    [confirmZIndexBase, items.length, onReorderRows],
  );

  return (
    <VeitInlineEditableList<FlatTagDraft>
      variant="text-color"
      surface="plain"
      className="space-y-0"
      listClassName={listClassName}
      items={items}
      canWrite={canWrite}
      disabled={disabled}
      error={null}
      strings={{
        addRow: strings.addRow,
        deleteRowSrLabel: strings.deleteRowSrLabel,
        emptyHint: strings.emptyHint,
      }}
      confirmZIndexBase={confirmZIndexBase}
      focusRowId={focusRowId}
      onFocusRowIdConsumed={onFocusRowIdConsumed}
      primaryInputIdPrefix={primaryInputIdPrefix}
      onAddRow={
        canWrite
          ? () => {
              const id = `t-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())}`;
              onItemsChange([...items, { id, name: '', hex_color: tagColorHexForIndex(items.length + 1) }]);
            }
          : undefined
      }
      addPlacement="footer"
      addButtonVariant="primary"
      reorder={reorder}
      getTitle={(item) => item.name}
      onTitleChange={(item, v) =>
        onItemsChange(items.map((x) => (x.id === item.id ? { ...x, name: v } : x)))
      }
      getHexColor={(item) => item.hex_color}
      onHexChange={(item, v) =>
        onItemsChange(items.map((x) => (x.id === item.id ? { ...x, hex_color: v } : x)))
      }
      defaultHex={defaultHex}
      colorPickerAriaLabel={strings.labelColor}
      placeholder={strings.namePlaceholder}
      deleteConfirm={deleteConfirm}
      onDeleteRow={(item) => void Promise.resolve(onDeleteRow(item))}
    />
  );
}

export { cloneFlatDraftRows, cloneNestedDraftRows, isTempFlatTag, flatDraftRowsEqual, nestedDraftRowsEqual } from './types.js';
