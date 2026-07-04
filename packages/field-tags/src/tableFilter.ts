import type { FieldTag } from './tree.js';
import { expandFilterTagIds } from './tree.js';

/** Deserialize VeitDataTable multi-select filter value (comma-separated IDs). */
export function parseTableMultiFilter(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Serialize VeitDataTable multi-select filter value. */
export function serializeTableMultiFilter(selected: string[]): string {
  return selected.join(',');
}

/** First numeric tag ID from a table column filter, or null. */
export function tagIdFromTableColumnFilter(raw: string): number | null {
  const selected = parseTableMultiFilter(raw);
  const first = selected[0] ? Number.parseInt(selected[0], 10) : null;
  return first != null && Number.isFinite(first) ? first : null;
}

export function setTableColumnTagFilter(
  columnFilters: Record<string, string>,
  columnId: string,
  tagId: number | null,
): Record<string, string> {
  const next = { ...columnFilters };
  if (tagId == null) delete next[columnId];
  else next[columnId] = serializeTableMultiFilter([String(tagId)]);
  return next;
}

/** Whether an entity's tag IDs match a single-tag filter (includes descendant tags). */
export function entityMatchesTagFilter(
  entityTagIds: readonly number[],
  filterTagId: number | null,
  allTags: FieldTag[],
): boolean {
  if (filterTagId == null) return true;
  const allowed = new Set(expandFilterTagIds([filterTagId], allTags));
  return entityTagIds.some((id) => allowed.has(id));
}
