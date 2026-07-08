import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { saveNestedFieldTagTree, type NestedFieldTagMutations } from './save.js';
import type { FieldTag } from './tree.js';

describe('saveNestedFieldTagTree', () => {
  it('creates parents before children when using temp IDs', async () => {
    const createOrder: number[] = [];
    const mutations: NestedFieldTagMutations = {
      createTag: async (input) => {
        createOrder.push(input.parent_id ?? 0);
        if (input.parent_id != null && input.parent_id < 0) {
          throw new Error('tag_parent_invalid');
        }
        const id = input.parent_id == null ? 100 : 101;
        return { id };
      },
      patchTag: async () => {},
      deleteTag: async () => {},
      moveTag: async () => {},
    };

    const rows: FieldTag[] = [
      { id: -2, field_id: 1, parent_id: -1, name: 'Child', sort_order: 0 },
      { id: -1, field_id: 1, parent_id: null, name: 'Parent', sort_order: 0 },
    ];

    await saveNestedFieldTagTree(rows, [], mutations);
    assert.deepEqual(createOrder, [0, 100]);
  });
});
