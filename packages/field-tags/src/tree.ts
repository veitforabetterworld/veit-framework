export type FieldTag = {
  id: number;
  field_id: number;
  parent_id: number | null;
  name: string;
  sort_order: number;
  hex_color?: string | null;
};

export type FieldDef = {
  id: number;
  tool_id: number;
  name: string;
  sort_order: number;
  allow_multiple: boolean;
  required: boolean;
  system_key?: string | null;
};

export type TagPickerOption = {
  id: number;
  fieldId: number;
  fieldName: string;
  name: string;
  path: string;
  depth: number;
  searchText: string;
  hex_color?: string | null;
};

export function buildTagChildrenMap(tags: FieldTag[]): Map<number | null, FieldTag[]> {
  const m = new Map<number | null, FieldTag[]>();
  for (const tag of tags) {
    const p = tag.parent_id ?? null;
    if (!m.has(p)) m.set(p, []);
    m.get(p)!.push(tag);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  }
  return m;
}

export function tagsForField(allTags: FieldTag[], fieldId: number, field?: FieldDef): FieldTag[] {
  if (field?.system_key && fieldId === 0 && allTags.length > 0) {
    const fieldIds = [...new Set(allTags.map((t) => t.field_id))];
    if (fieldIds.length === 1) return allTags.filter((t) => t.field_id === fieldIds[0]);
    return allTags;
  }
  return allTags.filter((t) => t.field_id === fieldId);
}

function flattenFieldTagOptions(
  field: FieldDef,
  byParent: Map<number | null, FieldTag[]>,
  parentId: number | null,
  depth: number,
  pathParts: string[],
): TagPickerOption[] {
  const nodes = byParent.get(parentId) ?? [];
  const out: TagPickerOption[] = [];
  for (const tag of nodes) {
    const pathPartsNext = [...pathParts, tag.name];
    const path = pathPartsNext.join(' › ');
    out.push({
      id: tag.id,
      fieldId: field.id,
      fieldName: field.name,
      name: tag.name,
      path,
      depth,
      searchText: `${field.name} ${path}`.toLowerCase(),
      hex_color: tag.hex_color,
    });
    out.push(...flattenFieldTagOptions(field, byParent, tag.id, depth + 1, pathPartsNext));
  }
  return out;
}

export function buildTagPickerOptions(fields: FieldDef[], allTags: FieldTag[]): TagPickerOption[] {
  const out: TagPickerOption[] = [];
  for (const field of fields) {
    const fieldTags = tagsForField(allTags, field.id, field);
    if (fieldTags.length === 0) continue;
    const byParent = buildTagChildrenMap(fieldTags);
    out.push(...flattenFieldTagOptions(field, byParent, null, 0, []));
  }
  return out;
}

export function tagPickerOptionsById(options: TagPickerOption[]): Map<number, TagPickerOption> {
  return new Map(options.map((o) => [o.id, o]));
}

export function sortFields(fields: FieldDef[]): FieldDef[] {
  return [...fields].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export function recordTagsByField(recordTags: FieldTag[]): Map<number, FieldTag[]> {
  const m = new Map<number, FieldTag[]>();
  for (const tag of recordTags) {
    const list = m.get(tag.field_id);
    if (list) list.push(tag);
    else m.set(tag.field_id, [tag]);
  }
  return m;
}

export function tagsById(allTags: FieldTag[]): Map<number, FieldTag> {
  return new Map(allTags.map((t) => [t.id, t]));
}

/** Stored tags plus all ancestor tags (deduplicated, root-first per chain). */
export function expandTagsWithAncestors(storedTags: FieldTag[], allTags: FieldTag[]): FieldTag[] {
  const byId = tagsById(allTags);
  const seen = new Set<number>();
  const out: FieldTag[] = [];
  for (const tag of storedTags) {
    const chain: FieldTag[] = [];
    let cur: FieldTag | undefined = tag;
    while (cur) {
      chain.unshift(cur);
      cur = cur.parent_id != null ? byId.get(cur.parent_id) : undefined;
    }
    for (const t of chain) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
  }
  return out;
}

export function recordTagsByFieldWithAncestors(
  recordTags: FieldTag[],
  allTags: FieldTag[],
): Map<number, FieldTag[]> {
  return recordTagsByField(expandTagsWithAncestors(recordTags, allTags));
}

function buildTagDescendantsMap(allTags: FieldTag[]): Map<number, number[]> {
  const byParent = buildTagChildrenMap(allTags);
  const memo = new Map<number, number[]>();

  function collect(id: number): number[] {
    const cached = memo.get(id);
    if (cached) return cached;
    const ids = [id];
    for (const child of byParent.get(id) ?? []) {
      ids.push(...collect(child.id));
    }
    memo.set(id, ids);
    return ids;
  }

  for (const tag of allTags) collect(tag.id);
  return memo;
}

/** Filter chip IDs expanded to include all descendant tag IDs (for API queries). */
export function expandFilterTagIds(filterIds: number[], allTags: FieldTag[]): number[] {
  const descendants = buildTagDescendantsMap(allTags);
  const out = new Set<number>();
  for (const id of filterIds) {
    for (const d of descendants.get(id) ?? [id]) out.add(d);
  }
  return [...out];
}

export const TAG_SORT_PREFIX = 'tag-';
export const TAG_PARENT_ZONE_PREFIX = 'tag-parent-';
export const TAG_PARENT_ROOT_ZONE = `${TAG_PARENT_ZONE_PREFIX}root`;

export function tagSortId(tagId: number): string {
  return `${TAG_SORT_PREFIX}${tagId}`;
}

export function tagParentZoneId(parentId: number | null): string {
  return parentId == null ? TAG_PARENT_ROOT_ZONE : `${TAG_PARENT_ZONE_PREFIX}${parentId}`;
}

export function parseTagSortId(id: string): number | null {
  if (!id.startsWith(TAG_SORT_PREFIX)) return null;
  const n = Number.parseInt(id.slice(TAG_SORT_PREFIX.length), 10);
  return Number.isNaN(n) ? null : n;
}

export function parseTagParentZoneId(id: string): number | null | undefined {
  if (!id.startsWith(TAG_PARENT_ZONE_PREFIX)) return undefined;
  const rest = id.slice(TAG_PARENT_ZONE_PREFIX.length);
  if (rest === 'root') return null;
  const n = Number.parseInt(rest, 10);
  return Number.isNaN(n) ? undefined : n;
}

export function isTagDescendant(allTags: FieldTag[], ancestorId: number, candidateId: number): boolean {
  const byParent = buildTagChildrenMap(allTags);
  const walk = (id: number): boolean => {
    for (const child of byParent.get(id) ?? []) {
      if (child.id === candidateId) return true;
      if (walk(child.id)) return true;
    }
    return false;
  };
  return walk(ancestorId);
}

export function canMoveTagToParent(
  allTags: FieldTag[],
  tagId: number,
  newParentId: number | null,
): boolean {
  if (newParentId == null) return true;
  if (newParentId === tagId) return false;
  return !isTagDescendant(allTags, tagId, newParentId);
}

export type TagTreeMovePlan = {
  tagId: number;
  parentId: number | null;
  orderedSiblingIds: number[];
};

/** Resolve drag target into parent + sibling order (null = no valid move). */
export function planTagTreeMove(
  activeId: string,
  overId: string,
  allTags: FieldTag[],
  byParent: Map<number | null, FieldTag[]>,
): TagTreeMovePlan | null {
  const tagId = parseTagSortId(activeId);
  if (tagId == null) return null;
  const tag = allTags.find((t) => t.id === tagId);
  if (!tag) return null;

  const zoneParentId = parseTagParentZoneId(overId);
  if (zoneParentId !== undefined) {
    if (!canMoveTagToParent(allTags, tagId, zoneParentId)) return null;
    const siblings = (byParent.get(zoneParentId) ?? []).filter((t) => t.id !== tagId);
    return { tagId, parentId: zoneParentId, orderedSiblingIds: [...siblings.map((t) => t.id), tagId] };
  }

  const overTagId = parseTagSortId(overId);
  if (overTagId == null || overTagId === tagId) return null;
  const overTag = allTags.find((t) => t.id === overTagId);
  if (!overTag) return null;

  const parentId = overTag.parent_id;
  if (!canMoveTagToParent(allTags, tagId, parentId)) return null;

  const siblings = (byParent.get(parentId) ?? []).filter((t) => t.id !== tagId);
  const overIndex = siblings.findIndex((t) => t.id === overTagId);
  const insertAt = overIndex < 0 ? siblings.length : overIndex;
  const orderedSiblingIds = siblings.map((t) => t.id);
  orderedSiblingIds.splice(insertAt, 0, tagId);
  return { tagId, parentId, orderedSiblingIds };
}

export function tagTreeMoveUnchanged(
  tag: FieldTag,
  plan: TagTreeMovePlan,
  byParent: Map<number | null, FieldTag[]>,
): boolean {
  const currentParent = tag.parent_id ?? null;
  if (currentParent !== plan.parentId) return false;
  const currentIds = (byParent.get(currentParent) ?? []).map((t) => t.id);
  return (
    currentIds.length === plan.orderedSiblingIds.length &&
    currentIds.every((id, i) => id === plan.orderedSiblingIds[i])
  );
}

/** Tag IDs whose own name or any ancestor name matches the query (for record search). */
export function tagIdsMatchingSearch(allTags: FieldTag[], query: string): number[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const byId = tagsById(allTags);
  const matches = new Set<number>();
  for (const tag of allTags) {
    let cur: FieldTag | undefined = tag;
    while (cur) {
      if (cur.name.toLowerCase().includes(q)) {
        matches.add(tag.id);
        break;
      }
      cur = cur.parent_id != null ? byId.get(cur.parent_id) : undefined;
    }
  }
  return [...matches];
}
