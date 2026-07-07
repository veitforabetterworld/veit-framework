/** Default prefix for `history.state` dialog markers. */
export const VEIT_DIALOG_DEFAULT_HISTORY_KEY = 'veit_dialog';

export type HistoryCloseFn = () => void;
export type HistoryEntryMode = 'push' | 'coalesce';

const dialogHistoryStack: HistoryCloseFn[] = [];
const dialogHistoryEntryMode = new Map<HistoryCloseFn, HistoryEntryMode>();
let dialogPopStateAttached = false;
let dialogPopStateSeq = 0;
/** `dialogHistorySyncBack`: suppress the next popstate handler (sync back without onClose). */
let dialogSuppressNextPopHandler = false;

const MAX_DIALOG_HISTORY_CHAIN = 48;

/** Build a unique marker key per dialog instance (React `useId`). */
export function veitDialogHistoryStateKey(reactId: string, explicitKey?: string): string {
  const base = explicitKey ?? VEIT_DIALOG_DEFAULT_HISTORY_KEY;
  const suffix = reactId.replace(/:/g, '');
  if (base === VEIT_DIALOG_DEFAULT_HISTORY_KEY) {
    return `${VEIT_DIALOG_DEFAULT_HISTORY_KEY}_${suffix}`;
  }
  return `${base}_${suffix}`;
}

function attachGlobalDialogPopState(): void {
  if (dialogPopStateAttached || typeof window === 'undefined') return;
  dialogPopStateAttached = true;
  window.addEventListener('popstate', () => {
    dialogPopStateSeq++;
    if (dialogSuppressNextPopHandler) {
      dialogSuppressNextPopHandler = false;
      return;
    }
    const close = dialogHistoryStack.pop();
    close?.();
  });
}

function buildDialogHistoryStateEntry(historyStateKey: string): unknown {
  const raw = typeof window !== 'undefined' ? window.history.state : null;
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>), [historyStateKey]: true };
  }
  return { [historyStateKey]: true };
}

/** Coalesce-Entity-Einträge liegen unter verschachtelten Overlay-Dialogen im Stack. */
function dialogHistoryStackInsert(close: HistoryCloseFn, mode: HistoryEntryMode): void {
  if (dialogHistoryIndexOf(close) !== -1) return;
  if (mode === 'coalesce' && dialogHistoryStack.length > 0) {
    dialogHistoryStack.unshift(close);
  } else {
    dialogHistoryStack.push(close);
  }
  dialogHistoryEntryMode.set(close, mode);
}

/** Unterdrückt genau den nächsten `popstate` (z. B. nach manuellem Stack-Abräumen). */
export function dialogHistorySuppressNextPopstate(): void {
  dialogSuppressNextPopHandler = true;
}

export function dialogHistoryPush(
  close: HistoryCloseFn,
  historyStateKey: string,
  mode: HistoryEntryMode = 'push',
): void {
  if (typeof window === 'undefined') return;
  attachGlobalDialogPopState();
  if (mode === 'coalesce' && historyStateHasDialogMarker(historyStateKey)) {
    dialogHistoryStackInsert(close, mode);
    return;
  }
  dialogHistoryStackInsert(close, mode);
  const state = buildDialogHistoryStateEntry(historyStateKey);
  if (mode === 'coalesce') {
    window.history.replaceState(state, '', window.location.href);
    return;
  }
  window.history.pushState(state, '', window.location.href);
}

export function dialogHistoryRemove(close: HistoryCloseFn): void {
  const i = dialogHistoryStack.lastIndexOf(close);
  if (i !== -1) dialogHistoryStack.splice(i, 1);
  dialogHistoryEntryMode.delete(close);
}

export function historyStateHasDialogMarker(historyStateKey: string): boolean {
  if (typeof window === 'undefined') return false;
  const s = window.history.state;
  return (
    s != null &&
    typeof s === 'object' &&
    !Array.isArray(s) &&
    (s as Record<string, unknown>)[historyStateKey] === true
  );
}

/** Entfernt nur den Dialog-Marker per `replaceState` — kein `history.back()`. */
export function dialogHistoryStripMarker(historyStateKey: string): void {
  if (typeof window === 'undefined') return;
  if (!historyStateHasDialogMarker(historyStateKey)) return;
  const raw = window.history.state;
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return;
  const next = { ...(raw as Record<string, unknown>) };
  delete next[historyStateKey];
  const state = Object.keys(next).length > 0 ? next : null;
  window.history.replaceState(state, '', window.location.href);
}

/** Remove stack entry and optionally `history.back()` without invoking onClose (nur Push-Modus). */
export function dialogHistorySyncBack(close: HistoryCloseFn, historyStateKey: string): void {
  const mode = dialogHistoryEntryMode.get(close) ?? 'push';
  dialogHistoryRemove(close);
  if (typeof window === 'undefined') return;
  if (mode === 'coalesce') {
    dialogHistoryStripMarker(historyStateKey);
    return;
  }
  if (historyStateHasDialogMarker(historyStateKey)) {
    dialogSuppressNextPopHandler = true;
    window.history.back();
  }
}

export function isTopDialogHistoryEntry(close: HistoryCloseFn): boolean {
  const n = dialogHistoryStack.length;
  return n > 0 && dialogHistoryStack[n - 1] === close;
}

export function dialogHistoryIndexOf(close: HistoryCloseFn): number {
  return dialogHistoryStack.lastIndexOf(close);
}

export function dialogHistoryStackLength(): number {
  return dialogHistoryStack.length;
}

export function dialogHistoryEntryModeFor(close: HistoryCloseFn): HistoryEntryMode | undefined {
  return dialogHistoryEntryMode.get(close);
}

/**
 * Coalesced Overlay über Entity-Dialog: Marker entfernen, Stack abräumen, kein `history.back()`.
 */
export function dialogHistoryDismissCoalescedOverlay(
  close: HistoryCloseFn,
  historyStateKey: string,
): void {
  dialogHistoryRemove(close);
  dialogHistoryStripMarker(historyStateKey);
}

export function navigateHistoryToClose(close: HistoryCloseFn, historyStateKey: string): void {
  if (typeof window === 'undefined') return;
  let guard = 0;
  let waitingForPopSeq: number | null = null;
  const step = () => {
    if (++guard > MAX_DIALOG_HISTORY_CHAIN) {
      dialogHistoryRemove(close);
      const mode = dialogHistoryEntryMode.get(close) ?? 'push';
      if (mode === 'coalesce') {
        dialogHistoryStripMarker(historyStateKey);
      } else if (historyStateHasDialogMarker(historyStateKey)) {
        dialogSuppressNextPopHandler = true;
        window.history.back();
      }
      return;
    }
    if (waitingForPopSeq !== null) {
      if (dialogPopStateSeq === waitingForPopSeq) {
        setTimeout(step, 8);
        return;
      }
      waitingForPopSeq = null;
    }
    const idx = dialogHistoryStack.lastIndexOf(close);
    if (idx === -1) return;
    if (isTopDialogHistoryEntry(close)) {
      window.history.back();
      return;
    }
    window.history.back();
    waitingForPopSeq = dialogPopStateSeq;
    setTimeout(step, 8);
  };
  step();
}

/** Test-only reset. */
export function _resetDialogHistoryForTests(): void {
  dialogHistoryStack.length = 0;
  dialogHistoryEntryMode.clear();
  dialogPopStateSeq = 0;
  dialogSuppressNextPopHandler = false;
}
