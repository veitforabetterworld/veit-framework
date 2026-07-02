import type { FieldDef, FieldTag } from '@veit/field-tags';

export type FlatTagDraft =
  | { id: number; name: string; hex_color: string | null }
  | { id: string; name: string; hex_color: string | null };

export type NestedTagDraft = FieldTag;

export function isTempFlatTag(
  row: FlatTagDraft,
): row is { id: string; name: string; hex_color: string | null } {
  return typeof row.id === 'string';
}

export function flatDraftRowsEqual(a: readonly FlatTagDraft[], b: readonly FlatTagDraft[], defaultHex: string): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (String(a[i].id) !== String(b[i].id)) return false;
    const na = String(a[i].name).trim();
    const nb = String(b[i].name).trim();
    const ha = String((a[i].hex_color ?? '').trim() || defaultHex).toLowerCase();
    const hb = String((b[i].hex_color ?? '').trim() || defaultHex).toLowerCase();
    if (na !== nb || ha !== hb) return false;
  }
  return true;
}

export function nestedDraftRowsEqual(a: readonly NestedTagDraft[], b: readonly NestedTagDraft[]): boolean {
  if (a.length !== b.length) return false;
  const byA = new Map(a.map((t) => [t.id, t]));
  for (const tag of b) {
    const cur = byA.get(tag.id);
    if (!cur) return false;
    if (
      cur.name.trim() !== tag.name.trim() ||
      (cur.hex_color ?? '') !== (tag.hex_color ?? '') ||
      (cur.parent_id ?? null) !== (tag.parent_id ?? null) ||
      cur.sort_order !== tag.sort_order
    ) {
      return false;
    }
  }
  return true;
}

export type FieldDefDraftInput = Pick<FieldDef, 'name' | 'allow_multiple' | 'required'>;

export type VeitFieldTagListStrings = {
  addRow: string;
  deleteRowSrLabel: string;
  emptyHint: string;
  namePlaceholder: string;
  labelColor: string;
  tagAddRoot: string;
  tagAddChild: string;
  tagNamePlaceholder: string;
  addButton: string;
  tagDragReorder: string;
  tagDropChildHint: string;
  deleteLabel: string;
  deleteLabelConfirm: string;
  delete: string;
  cancel: string;
  close: string;
};

export type VeitFieldTagFieldsStrings = {
  customFieldsTitle: string;
  customFieldsHint: string;
  fieldName: string;
  fieldNamePlaceholder: string;
  fieldAdd: string;
  fieldsEmpty: string;
  tagEditButton: string;
  fieldDeleteConfirmTitle: string;
  fieldDeleteConfirmMessage: string;
  fieldAllowMultiple: string;
  fieldRequired: string;
  delete: string;
  cancel: string;
};

export type VeitFieldTagPickerStrings = {
  pickTitle: string;
  tagSearchPlaceholder: string;
  tagSearchAdd: string;
  tagSearchChange: string;
  tagEditButton: string;
  tagPickerEmpty: string;
  tagPickerEmptyManage: string;
  tagNoResults: string;
  remove: string;
  close: string;
};

export type VeitFieldTagEditDialogStrings = {
  cancel: string;
  save: string;
  close: string;
};

export function allocNestedTempTagId(rows: readonly NestedTagDraft[]): number {
  let min = 0;
  for (const row of rows) {
    if (row.id < min) min = row.id;
  }
  return min - 1;
}

export function cloneNestedDraftRows(rows: readonly NestedTagDraft[]): NestedTagDraft[] {
  return rows.map((x) => ({ ...x }));
}

export function cloneFlatDraftRows(rows: readonly FlatTagDraft[]): FlatTagDraft[] {
  return rows.map((x) => ({ ...x }));
}
