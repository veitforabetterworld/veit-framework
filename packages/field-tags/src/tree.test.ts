import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  TAG_GOLDEN_ANGLE_DEG,
  buildTagChildrenMap,
  buildTagPickerOptions,
  canMoveTagToParent,
  expandFilterTagIds,
  planTagTreeMove,
  sortFields,
  tagColorHexForIndex,
  type FieldDef,
  type FieldTag,
} from './index.js';

const field: FieldDef = {
  id: 1,
  tool_id: 10,
  name: 'Category',
  sort_order: 0,
  allow_multiple: true,
  required: false,
};

const tags: FieldTag[] = [
  { id: 1, field_id: 1, parent_id: null, name: 'A', sort_order: 0 },
  { id: 2, field_id: 1, parent_id: 1, name: 'B', sort_order: 0 },
  { id: 3, field_id: 1, parent_id: 1, name: 'C', sort_order: 1 },
  { id: 4, field_id: 1, parent_id: null, name: 'D', sort_order: 1 },
];

describe('@veit/field-tags colors', () => {
  it('uses golden angle steps on the hue circle', () => {
    assert.ok(Math.abs(TAG_GOLDEN_ANGLE_DEG - 137.508) < 0.01);
    const c1 = tagColorHexForIndex(1);
    const c4 = tagColorHexForIndex(4);
    assert.match(c1, /^#[0-9a-f]{6}$/);
    assert.match(c4, /^#[0-9a-f]{6}$/);
    assert.notEqual(c1, c4);
  });
});

describe('@veit/field-tags tree', () => {
  it('sorts fields by sort_order then id', () => {
    const sorted = sortFields([
      { ...field, id: 3, sort_order: 1 },
      { ...field, id: 1, sort_order: 0 },
      { ...field, id: 2, sort_order: 0 },
    ]);
    assert.deepEqual(sorted.map((f) => f.id), [1, 2, 3]);
  });

  it('builds parent-child map ordered by sort_order', () => {
    const map = buildTagChildrenMap(tags);
    assert.deepEqual((map.get(1) ?? []).map((t) => t.id), [2, 3]);
    assert.deepEqual((map.get(null) ?? []).map((t) => t.id), [1, 4]);
  });

  it('resolves system fields with placeholder id 0', () => {
    const systemField: FieldDef = {
      id: 0,
      tool_id: 10,
      name: 'Labels',
      sort_order: 0,
      allow_multiple: true,
      required: false,
      system_key: 'kanban',
    };
    const options = buildTagPickerOptions([systemField], tags);
    assert.equal(options.length, 4);
  });

  it('flattens picker options with depth', () => {
    const options = buildTagPickerOptions([field], tags);
    assert.equal(options.length, 4);
    assert.equal(options.find((o) => o.id === 2)?.depth, 1);
    assert.match(options.find((o) => o.id === 2)?.path ?? '', /A › B/);
  });

  it('rejects moving a tag under its descendant', () => {
    assert.equal(canMoveTagToParent(tags, 1, 2), false);
    assert.equal(canMoveTagToParent(tags, 2, 3), true);
  });

  it('expands filter ids to descendants', () => {
    assert.deepEqual(expandFilterTagIds([1], tags).sort(), [1, 2, 3]);
  });

  it('entityMatchesTagFilter includes descendants', async () => {
    const { entityMatchesTagFilter } = await import('./tableFilter.js');
    assert.equal(entityMatchesTagFilter([2], 1, tags), true);
    assert.equal(entityMatchesTagFilter([4], 1, tags), false);
    assert.equal(entityMatchesTagFilter([], null, tags), true);
  });

  it('table column tag filter round-trips', async () => {
    const {
      parseTableMultiFilter,
      serializeTableMultiFilter,
      tagIdFromTableColumnFilter,
      setTableColumnTagFilter,
    } = await import('./tableFilter.js');
    assert.deepEqual(parseTableMultiFilter('1, 2'), ['1', '2']);
    assert.equal(serializeTableMultiFilter(['3']), '3');
    assert.equal(tagIdFromTableColumnFilter('42'), 42);
    assert.deepEqual(setTableColumnTagFilter({}, 'col', 5), { col: '5' });
    assert.deepEqual(setTableColumnTagFilter({ col: '5' }, 'col', null), {});
  });

  it('plans tree moves onto parent zones', () => {
    const byParent = buildTagChildrenMap(tags);
    const plan = planTagTreeMove('tag-4', 'tag-parent-1', tags, byParent);
    assert.deepEqual(plan, { tagId: 4, parentId: 1, orderedSiblingIds: [2, 3, 4] });
  });
});
