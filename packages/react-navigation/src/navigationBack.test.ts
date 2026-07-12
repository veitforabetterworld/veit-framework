import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clearExternalEntrySession,
  hasInAppHistoryBack,
  historyStateIndex,
  isExternalEntrySession,
  markExternalEntrySession,
  shouldNavigateBackViaFallback,
} from './navigationBack.js';

function withSessionStorage(run: () => void): void {
  const map = new Map<string, string>();
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage;
  const prevStorage = globalThis.sessionStorage;
  const prevWindow = globalThis.window;
  const win = (prevWindow ?? {}) as Window & typeof globalThis;
  win.sessionStorage = storage;
  globalThis.sessionStorage = storage;
  globalThis.window = win;
  try {
    run();
  } finally {
    globalThis.sessionStorage = prevStorage;
    globalThis.window = prevWindow;
  }
}

describe('navigationBack', () => {
  it('historyStateIndex returns null without window', () => {
    const prev = globalThis.window;
    // @ts-expect-error test env
    delete globalThis.window;
    assert.equal(historyStateIndex(), null);
    globalThis.window = prev;
  });

  it('shouldNavigateBackViaFallback is true when external entry session is set', () => {
    withSessionStorage(() => {
      markExternalEntrySession();
      try {
        assert.equal(isExternalEntrySession(), true);
        assert.equal(shouldNavigateBackViaFallback(), true);
      } finally {
        clearExternalEntrySession();
      }
    });
  });

  it('hasInAppHistoryBack reads idx from history.state', () => {
    if (typeof window === 'undefined') return;
    const original = window.history.state;
    window.history.replaceState({ idx: 2 }, '');
    try {
      assert.equal(hasInAppHistoryBack(), true);
      window.history.replaceState({ idx: 0 }, '');
      assert.equal(hasInAppHistoryBack(), false);
    } finally {
      window.history.replaceState(original, '');
    }
  });
});
