import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import {
  VEIT_DIALOG_DEFAULT_HISTORY_KEY,
  _resetDialogHistoryForTests,
  dialogHistoryDismissCoalescedOverlay,
  dialogHistoryIndexOf,
  dialogHistoryPush,
  dialogHistoryRemove,
  dialogHistoryStackLength,
  dialogHistorySyncBack,
  historyStateHasDialogMarker,
  veitDialogHistoryStateKey,
  type HistoryCloseFn,
} from './dialogHistory.js';

function mockWindowHistory() {
  let state: Record<string, unknown> | null = null;
  const backs: unknown[] = [];
  const pushes: unknown[] = [];
  const replaces: unknown[] = [];
  const g = globalThis as typeof globalThis & { window?: Window & typeof globalThis };
  g.window = {
    history: {
      get state() {
        return state;
      },
      get length() {
        return 1 + pushes.length;
      },
      pushState(next: unknown) {
        state = next as Record<string, unknown>;
        pushes.push(next);
      },
      replaceState(next: unknown) {
        state = next as Record<string, unknown>;
        replaces.push(next);
      },
      back() {
        backs.push(state);
      },
    },
    location: { href: 'https://example.test/app?card=1' },
    addEventListener: () => {},
    localStorage: { getItem: () => null },
  } as unknown as Window & typeof globalThis;
  return { backs, pushes, replaces, getState: () => state, setState: (s: Record<string, unknown> | null) => { state = s; } };
}

describe('dialogHistory', () => {
  beforeEach(() => {
    _resetDialogHistoryForTests();
    delete (globalThis as { window?: unknown }).window;
  });

  it('builds unique history state keys per React instance id', () => {
    const a = veitDialogHistoryStateKey(':r1:', VEIT_DIALOG_DEFAULT_HISTORY_KEY);
    const b = veitDialogHistoryStateKey(':r2:', VEIT_DIALOG_DEFAULT_HISTORY_KEY);
    assert.notEqual(a, b);
    assert.match(a, /^veit_dialog_r1$/);
  });

  it('push mode adds a history entry; coalesce replaces', () => {
    const { pushes, replaces } = mockWindowHistory();
    const close: HistoryCloseFn = () => {};
    dialogHistoryPush(close, 'key_a', 'push');
    assert.equal(pushes.length, 1);
    assert.equal(replaces.length, 0);
    dialogHistoryRemove(close);
    dialogHistoryPush(close, 'key_b', 'coalesce');
    assert.equal(pushes.length, 1);
    assert.equal(replaces.length, 1);
  });

  it('syncBack coalesce strips marker without history.back', () => {
    const h = mockWindowHistory();
    const close: HistoryCloseFn = () => {};
    dialogHistoryPush(close, 'key_coalesce', 'coalesce');
    assert.equal(historyStateHasDialogMarker('key_coalesce'), true);
    dialogHistorySyncBack(close, 'key_coalesce');
    assert.equal(h.backs.length, 0);
    assert.equal(historyStateHasDialogMarker('key_coalesce'), false);
  });

  it('syncBack push calls history.back when marker is present', () => {
    const h = mockWindowHistory();
    const close: HistoryCloseFn = () => {};
    dialogHistoryPush(close, 'key_sync', 'push');
    assert.equal(dialogHistoryIndexOf(close), 0);
    dialogHistorySyncBack(close, 'key_sync');
    assert.equal(dialogHistoryIndexOf(close), -1);
    assert.equal(h.backs.length, 1);
    assert.equal(historyStateHasDialogMarker('key_sync'), true);
  });

  it('remove drops stack entry without history.back', () => {
    mockWindowHistory();
    const close: HistoryCloseFn = () => {};
    dialogHistoryPush(close, 'key_rm', 'push');
    dialogHistoryRemove(close);
    assert.equal(dialogHistoryIndexOf(close), -1);
  });

  it('push mode always adds a history entry even when marker already exists (strict remount)', () => {
    const h = mockWindowHistory();
    const close: HistoryCloseFn = () => {};
    dialogHistoryPush(close, 'key_dup', 'push');
    assert.equal(h.pushes.length, 1);
    assert.equal(dialogHistoryStackLength(), 1);
    dialogHistoryRemove(close);
    dialogHistoryPush(close, 'key_dup', 'push');
    assert.equal(h.pushes.length, 2);
    assert.equal(dialogHistoryStackLength(), 1);
    assert.equal(historyStateHasDialogMarker('key_dup'), true);
  });

  it('coalesce re-inserts at stack bottom when overlays are open', () => {
    mockWindowHistory();
    const parent: HistoryCloseFn = () => {};
    const overlay: HistoryCloseFn = () => {};
    dialogHistoryPush(parent, 'key_parent', 'coalesce');
    dialogHistoryPush(overlay, 'key_overlay', 'push');
    assert.equal(dialogHistoryStackLength(), 2);
    dialogHistoryRemove(parent);
    dialogHistoryPush(parent, 'key_parent', 'coalesce');
    assert.equal(dialogHistoryIndexOf(parent), 0);
    assert.equal(dialogHistoryIndexOf(overlay), 1);
  });

  it('dismissCoalescedOverlay strips marker without history.back', () => {
    const h = mockWindowHistory();
    const parent: HistoryCloseFn = () => {};
    const overlay: HistoryCloseFn = () => {};
    dialogHistoryPush(parent, 'key_parent', 'coalesce');
    dialogHistoryPush(overlay, 'key_overlay', 'coalesce');
    assert.equal(dialogHistoryStackLength(), 2);
    assert.equal(historyStateHasDialogMarker('key_overlay'), true);
    dialogHistoryDismissCoalescedOverlay(overlay, 'key_overlay');
    assert.equal(h.backs.length, 0);
    assert.equal(dialogHistoryIndexOf(overlay), -1);
    assert.equal(dialogHistoryIndexOf(parent), 0);
    assert.equal(historyStateHasDialogMarker('key_overlay'), false);
    assert.equal(historyStateHasDialogMarker('key_parent'), true);
  });
});
