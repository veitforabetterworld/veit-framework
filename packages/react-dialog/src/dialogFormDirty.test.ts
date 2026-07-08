import { describe, it } from 'node:test';

import assert from 'node:assert/strict';

import {

  applyDialogSaveSuccess,

  commitFormBaseline,

  hasAnyFieldInput,

} from './dialogFormDirty.js';



describe('hasAnyFieldInput', () => {

  it('treats distinct empty object references as equal', () => {

    const draft = { name: '', cellDraft: {} };

    const baseline = { name: '', cellDraft: {} };

    assert.equal(hasAnyFieldInput(draft, baseline), false);

  });



  it('detects non-empty strings after trim', () => {

    const draft = { title: '  hello  ' };

    const baseline = { title: '' };

    assert.equal(hasAnyFieldInput(draft, baseline), true);

  });



  it('detects changed nested cell draft values', () => {

    const draft = { cellDraft: { 1: { value_text: 'x' } } };

    const baseline = { cellDraft: {} };

    assert.equal(hasAnyFieldInput(draft, baseline), true);

  });

});



describe('commitFormBaseline', () => {

  it('clones draft into baseline', () => {

    let baseline = { name: 'old', nested: { x: 1 } };

    const draft = { name: 'new', nested: { x: 2 } };

    commitFormBaseline((next) => {

      baseline = next;

    }, draft);

    assert.deepEqual(baseline, draft);

    assert.notEqual(baseline.nested, draft.nested);

  });

});



describe('applyDialogSaveSuccess', () => {
  it('commits baseline and dismisses', () => {
    let baseline = { v: 0 };
    let draft = { v: 1 };
    let dismissed = false;
    applyDialogSaveSuccess({
      formBaseline: {
        setBaseline: (next) => {
          baseline = next as { v: number };
        },
        getDraft: () => draft,
      },
      dismiss: () => {
        dismissed = true;
      },
    });
    assert.deepEqual(baseline, { v: 1 });
    assert.equal(dismissed, true);
  });

  it('dismisses without baseline commit when only dismiss is provided', () => {
    let dismissed = false;
    applyDialogSaveSuccess({
      dismiss: () => {
        dismissed = true;
      },
    });
    assert.equal(dismissed, true);
  });
});


