import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveVeitDialogHistoryMode, veitDialogHistoryFlags } from './dialogHistoryMode.js';

describe('dialogHistoryMode', () => {
  it('resolves explicit historyMode', () => {
    assert.equal(resolveVeitDialogHistoryMode({ historyMode: 'entity' }), 'entity');
    assert.equal(resolveVeitDialogHistoryMode({ historyMode: 'sheet' }), 'sheet');
  });

  it('maps legacy coalesce/nested flags', () => {
    assert.equal(resolveVeitDialogHistoryMode({ historyCoalesce: true }), 'entity');
    assert.equal(resolveVeitDialogHistoryMode({ historyNested: true }), 'overlay');
    assert.equal(resolveVeitDialogHistoryMode({}), 'overlay');
  });

  it('entity mode coalesces history', () => {
    const f = veitDialogHistoryFlags('entity');
    assert.equal(f.historyCoalesce, true);
    assert.equal(f.syncHistory, true);
  });

  it('none mode skips history sync', () => {
    assert.equal(veitDialogHistoryFlags('none').syncHistory, false);
  });
});
