export { VeitFieldTagListEditor } from './VeitFieldTagListEditor.js';
export {
  cloneFlatDraftRows,
  cloneNestedDraftRows,
  flatDraftRowsEqual,
  isTempFlatTag,
  nestedDraftRowsEqual,
} from './types.js';
export { VeitFieldTagEditDialog, type VeitFieldTagEditDialogProps } from './VeitFieldTagEditDialog.js';
export { VeitFieldTagFieldsEditor, type VeitFieldTagFieldsEditorProps } from './VeitFieldTagFieldsEditor.js';
export { VeitFieldTagPicker, type VeitFieldTagPickerProps } from './VeitFieldTagPicker.js';
export { VeitFieldTagBadge, type VeitFieldTagBadgeProps } from './VeitFieldTagBadge.js';
export { VeitFieldTagRecordBadges, type VeitFieldTagRecordBadgesProps } from './VeitFieldTagRecordBadges.js';
export { VeitFieldTagFilterBar, type VeitFieldTagFilterBarProps } from './VeitFieldTagFilterBar.js';
export type {
  FlatTagDraft,
  NestedTagDraft,
  VeitFieldTagEditDialogStrings,
  VeitFieldTagFieldsStrings,
  VeitFieldTagListStrings,
  VeitFieldTagPickerStrings,
} from './types.js';

/** Tag-Baum ohne UI aus '@veit/field-tags': Web-Apps importieren alles über dieses Paket. */
export {
  TAG_GOLDEN_ANGLE_DEG,
  normalizeTagHexColor,
  tagColor,
  tagColorHexForIndex,
  TAG_PARENT_ROOT_ZONE,
  TAG_PARENT_ZONE_PREFIX,
  TAG_SORT_PREFIX,
  buildTagChildrenMap,
  buildTagColorIndexMap,
  buildTagPickerOptions,
  canMoveTagToParent,
  expandFilterTagIds,
  isTagDescendant,
  parseTagParentZoneId,
  parseTagSortId,
  planTagTreeMove,
  recordTagsByField,
  sortFields,
  tagIdsMatchingSearch,
  tagParentZoneId,
  tagPickerOptionsById,
  tagSortId,
  tagTreeMoveUnchanged,
  tagsById,
  tagsDepthFirstOrder,
  tagsForField,
  tagsForRecordDisplay,
  tagsForRecordDisplayByIds,
  saveNestedFieldTagTree,
  entityMatchesTagFilter,
  parseTableMultiFilter,
  serializeTableMultiFilter,
  setTableColumnTagFilter,
  tagIdFromTableColumnFilter,
  toggleTagFilterId,
  type FieldDef,
  type FieldTag,
  type NestedFieldTagMutations,
  type TagPickerOption,
  type TagTreeMovePlan,
} from '@veit/field-tags';
