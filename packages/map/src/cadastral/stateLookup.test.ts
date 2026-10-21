import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveCadastralStateId } from './stateLookup.js';

describe('resolveCadastralStateId', () => {
  it('detects states by polygon boundary instead of bounding boxes', () => {
    assert.equal(resolveCadastralStateId(52.39, 13.07), 'BB');
    assert.equal(resolveCadastralStateId(52.52, 13.405), 'BE');
    assert.equal(resolveCadastralStateId(50.937, 6.96), 'NW');
    assert.equal(resolveCadastralStateId(48.856, 2.352), null);
  });
});
