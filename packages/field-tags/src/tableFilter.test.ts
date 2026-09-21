import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toggleTagFilterId } from './tableFilter.js';

describe('toggleTagFilterId', () => {
  it('sets filter when none active', () => {
    assert.equal(toggleTagFilterId(null, 42), 42);
  });

  it('clears filter when same tag clicked again', () => {
    assert.equal(toggleTagFilterId(42, 42), null);
  });

  it('switches filter to a different tag', () => {
    assert.equal(toggleTagFilterId(42, 99), 99);
  });
});
