import { buildTagChildrenMap, tagsDepthFirstOrder, tagTreeMoveUnchanged, type FieldTag } from './tree.js';

export type NestedFieldTagMutations = {
  createTag: (input: {
    parent_id: number | null;
    name: string;
    sort_order: number;
    hex_color?: string | null;
  }) => Promise<{ id: number }>;
  patchTag: (
    tagId: number,
    patch: { name?: string; hex_color?: string | null; sort_order?: number },
  ) => Promise<void>;
  deleteTag: (tagId: number) => Promise<void>;
  moveTag: (tagId: number, parent_id: number | null) => Promise<void>;
};

/** Persist nested tag tree draft: create, patch, delete, then parent/order moves. */
export async function saveNestedFieldTagTree(
  rows: FieldTag[],
  baseline: FieldTag[],
  mutations: NestedFieldTagMutations,
): Promise<void> {
  const baselineById = new Map(baseline.map((tag) => [tag.id, tag]));
  const rowById = new Map(rows.map((tag) => [tag.id, tag]));
  const tempIdToReal = new Map<number, number>();
  const resolveId = (id: number) => (id < 0 ? (tempIdToReal.get(id) ?? id) : id);

  const newTags = tagsDepthFirstOrder(rows).filter((tag) => tag.id < 0);
  for (const tag of newTags) {
    const parentId = tag.parent_id == null ? null : resolveId(tag.parent_id);
    const created = await mutations.createTag({
      parent_id: parentId,
      name: tag.name.trim(),
      sort_order: tag.sort_order,
      hex_color: tag.hex_color ?? undefined,
    });
    tempIdToReal.set(tag.id, created.id);
  }

  for (const tag of rows) {
    if (tag.id < 0) continue;
    const orig = baselineById.get(tag.id);
    if (!orig) continue;
    const patch: { name?: string; hex_color?: string | null; sort_order?: number } = {};
    if (tag.name.trim() !== orig.name.trim()) patch.name = tag.name.trim();
    if ((tag.hex_color ?? '') !== (orig.hex_color ?? '')) patch.hex_color = tag.hex_color ?? undefined;
    if (tag.sort_order !== orig.sort_order) patch.sort_order = tag.sort_order;
    if (Object.keys(patch).length > 0) {
      await mutations.patchTag(tag.id, patch);
    }
  }

  for (const tag of baseline) {
    if (!rowById.has(tag.id)) {
      await mutations.deleteTag(tag.id);
    }
  }

  const persistedRows = rows
    .map((tag) => ({
      ...tag,
      id: resolveId(tag.id),
      parent_id: tag.parent_id == null ? null : resolveId(tag.parent_id),
    }))
    .filter((tag) => tag.id > 0);

  const byParent = buildTagChildrenMap(persistedRows);
  for (const [parentId, siblings] of byParent.entries()) {
    const orderedSiblingIds = siblings.map((s) => s.id);
    for (const tag of siblings) {
      const orig = baselineById.get(tag.id);
      if (!orig) continue;
      const plan = { tagId: tag.id, parentId, orderedSiblingIds };
      if (!tagTreeMoveUnchanged(orig, plan, byParent)) {
        await mutations.moveTag(tag.id, parentId);
        await Promise.all(
          orderedSiblingIds.map((id, sort_order) => mutations.patchTag(id, { sort_order })),
        );
      }
    }
  }
}
