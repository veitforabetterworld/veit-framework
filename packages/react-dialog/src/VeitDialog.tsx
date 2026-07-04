import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
const sizeMax: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-xl',
};

/** Kein festes px-Deckel: wächst mit dem Inhalt bis knapp unter die sichtbare Viewport-Höhe, dann erst Scroll. */
const DIALOG_PANEL_MAX_H =
  'max-h-[min(96dvh,calc(100svh-2rem))]';

const DIALOG_BOTTOM_DOCK_MAX_H = 'max-h-[min(96dvh,calc(100svh-1rem))]';

/** Loslassen: diese Verschiebung (px) oder Anteil Panelhöhe reicht zum Schließen ohne Fling. */
const VEIT_DIALOG_SWIPE_CLOSE_MIN_PX = 88;
const VEIT_DIALOG_SWIPE_CLOSE_RATIO_OF_PANEL = 0.26;
/** Loslassen: Finger-Geschwindigkeit nach unten (px/ms); darüber immer schließen. */
const VEIT_DIALOG_SWIPE_FLING_CLOSE_PX_PER_MS = 0.52;
/** Starker Wischer nach oben beim Loslassen: immer wieder öffnen (abbricht Schließen). */
const VEIT_DIALOG_SWIPE_FLING_CANCEL_PX_PER_MS = -0.42;
/** Maximale Finger-Versetzung, die wir spiegeln (kein Kunst-Clamp bei 300px mehr). */
const translateFromFingerDy = (dy: number): number =>
  typeof window === 'undefined' ? Math.max(0, dy) : Math.max(0, Math.min(dy, window.innerHeight * 1.25));

/**
 * Touch: Panel 1:1 mit vertikalem Fingerweg; Loslassen per Position oder Abwärts-Fling schließt.
 * Header immer; Body nur oben bzw. ohne Scroll.
 * Native Listener mit `passive: false` auf `touchmove` (iOS).
 */
function useVeitDialogSwipeDismissEffect(opts: {
  open: boolean;
  swipeDisabled: boolean;
  bodyHasVerticalScroll: boolean;
  attemptDismiss: () => void;
  panelRef: MutableRefObject<HTMLDivElement | null>;
  headerRef: MutableRefObject<HTMLDivElement | null>;
  bodyScrollRef: MutableRefObject<HTMLDivElement | null>;
}) {
  const { open, swipeDisabled, bodyHasVerticalScroll, attemptDismiss, panelRef, headerRef, bodyScrollRef } = opts;
  const attemptDismissRef = useRef(attemptDismiss);
  attemptDismissRef.current = attemptDismiss;
  const swipeDisabledRef = useRef(swipeDisabled);
  swipeDisabledRef.current = swipeDisabled;
  const bodyHasVerticalScrollRef = useRef(bodyHasVerticalScroll);
  bodyHasVerticalScrollRef.current = bodyHasVerticalScroll;

  const clearTransform = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    panel.style.transform = '';
    panel.style.transition = '';
  }, [panelRef]);

  useEffect(() => {
    if (!open) clearTransform();
  }, [open, clearTransform]);

  useEffect(() => {
    if (!open || swipeDisabled) return;
    const panel = panelRef.current;
    const header = headerRef.current;
    const body = bodyScrollRef.current;
    if (!panel || !header || !body) return;

    let startY = 0;
    let startX = 0;
    let dragging = false;
    let lastMoveY = 0;
    let lastMoveT = 0;
    let velocityYPxPerMs = 0;

    const parseTranslatePx = (): number => {
      const m = /translateY\(([-\d.]+)px\)/.exec(panel.style.transform);
      return m ? parseFloat(m[1]) : 0;
    };

    const resetVelocityTracker = () => {
      velocityYPxPerMs = 0;
      lastMoveY = 0;
      lastMoveT = 0;
    };

    const applyDrag = (dyFromStart: number) => {
      const t = translateFromFingerDy(dyFromStart);
      panel.style.transition = 'none';
      panel.style.transform = `translateY(${t}px)`;
    };

    const snapBack = () => {
      panel.style.transition = 'transform 0.24s cubic-bezier(0.32, 0.72, 0, 1)';
      panel.style.transform = 'translateY(0)';
      window.setTimeout(() => {
        if (!panelRef.current || panelRef.current !== panel) return;
        if (panel.style.transform === 'translateY(0px)' || panel.style.transform === 'translateY(0)') {
          clearTransform();
        }
      }, 260);
    };

    const dismissThresholdPx = (): number => {
      const ph = panel.getBoundingClientRect().height || 0;
      const ratioPx = ph > 0 ? ph * VEIT_DIALOG_SWIPE_CLOSE_RATIO_OF_PANEL : VEIT_DIALOG_SWIPE_CLOSE_MIN_PX;
      return Math.max(VEIT_DIALOG_SWIPE_CLOSE_MIN_PX, ratioPx);
    };

    const endGesture = () => {
      const wasDragging = dragging;
      dragging = false;
      if (!wasDragging) return;
      const px = parseTranslatePx();
      const thr = dismissThresholdPx();
      const vy = velocityYPxPerMs;

      if (vy <= VEIT_DIALOG_SWIPE_FLING_CANCEL_PX_PER_MS) {
        if (px > 0) snapBack();
        else clearTransform();
        resetVelocityTracker();
        return;
      }

      const flingShut = vy >= VEIT_DIALOG_SWIPE_FLING_CLOSE_PX_PER_MS;
      const pastPosition = px >= thr;

      if (flingShut || pastPosition) {
        clearTransform();
        attemptDismissRef.current();
        resetVelocityTracker();
        return;
      }
      if (px > 0) snapBack();
      else clearTransform();
      resetVelocityTracker();
    };

    const moveOpts: AddEventListenerOptions = { passive: false };

    const dominantVertical = (dy: number, dx: number) =>
      Math.abs(dy) >= Math.max(6, Math.abs(dx) * 0.82);

    const trackVelocity = (clientY: number) => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (lastMoveT <= 0) {
        lastMoveY = clientY;
        lastMoveT = now;
        return;
      }
      const dt = Math.max(4, now - lastMoveT);
      velocityYPxPerMs = (clientY - lastMoveY) / dt;
      lastMoveY = clientY;
      lastMoveT = now;
    };

    const onHeaderStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      dragging = false;
      resetVelocityTracker();
    };

    const onHeaderMove = (e: TouchEvent) => {
      if (swipeDisabledRef.current || e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      const dy = y - startY;
      const dx = e.touches[0].clientX - startX;
      if (dy <= 0 || !dominantVertical(dy, dx)) return;
      if (!dragging) {
        dragging = true;
        lastMoveY = y;
        lastMoveT = typeof performance !== 'undefined' ? performance.now() : Date.now();
        velocityYPxPerMs = 0;
      }
      e.preventDefault();
      trackVelocity(y);
      applyDrag(dy);
    };

    const onBodyStart = (e: TouchEvent) => {
      if (bodyHasVerticalScrollRef.current) return;
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      dragging = false;
      resetVelocityTracker();
    };

    const onBodyMove = (e: TouchEvent) => {
      if (bodyHasVerticalScrollRef.current) return;
      if (swipeDisabledRef.current || e.touches.length !== 1) return;
      const scr = bodyScrollRef.current;
      const pad = 2;
      const hasOverflow = !!(scr && scr.scrollHeight > scr.clientHeight + pad);
      const atTop = !scr || scr.scrollTop <= 1;

      if (hasOverflow && !atTop) {
        if (dragging) {
          clearTransform();
          dragging = false;
          resetVelocityTracker();
        }
        startY = e.touches[0].clientY;
        startX = e.touches[0].clientX;
        return;
      }

      const y = e.touches[0].clientY;
      const dy = y - startY;
      const dx = e.touches[0].clientX - startX;
      if (dy <= 0 || !dominantVertical(dy, dx)) return;

      if (!dragging) {
        dragging = true;
        lastMoveY = y;
        lastMoveT = typeof performance !== 'undefined' ? performance.now() : Date.now();
        velocityYPxPerMs = 0;
      }
      e.preventDefault();
      trackVelocity(y);
      applyDrag(dy);
    };

    const onEnd = () => endGesture();

    header.addEventListener('touchstart', onHeaderStart, { passive: true });
    header.addEventListener('touchmove', onHeaderMove, moveOpts);
    header.addEventListener('touchend', onEnd);
    header.addEventListener('touchcancel', onEnd);

    if (!bodyHasVerticalScrollRef.current) {
      body.addEventListener('touchstart', onBodyStart, { passive: true });
      body.addEventListener('touchmove', onBodyMove, moveOpts);
      body.addEventListener('touchend', onEnd);
      body.addEventListener('touchcancel', onEnd);
    }

    return () => {
      header.removeEventListener('touchstart', onHeaderStart);
      header.removeEventListener('touchmove', onHeaderMove);
      header.removeEventListener('touchend', onEnd);
      header.removeEventListener('touchcancel', onEnd);
      body.removeEventListener('touchstart', onBodyStart);
      body.removeEventListener('touchmove', onBodyMove);
      body.removeEventListener('touchend', onEnd);
      body.removeEventListener('touchcancel', onEnd);
    };
  }, [open, swipeDisabled, bodyHasVerticalScroll, attemptDismiss, panelRef, headerRef, bodyScrollRef, clearTransform]);
}

/** Default `history.pushState` marker property for dialog entries. */
export const VEIT_DIALOG_DEFAULT_HISTORY_KEY = 'veit_dialog';

const VeitDialogDismissContext = createContext<(() => void) | null>(null);

/**
 * {@link VeitDialogEditActionsFooter} trägt hier `dirty === true` ein; Schließen löst dann
 * optional {@link VeitDialogProps.unsavedChangesConfirm} aus. Eigene Footer: {@link useVeitDialogRegisterUnsavedDirty}.
 */
const VeitDialogUnsavedDirtyRegistrationContext = createContext<((dirty: boolean) => void) | null>(null);

/** Optionaler Save-Handler für das „Ungespeicherte Änderungen“-Popup. */
const VeitDialogUnsavedSaveRegistrationContext = createContext<((onSave: (() => void | Promise<void>) | null) => void) | null>(
  null,
);

export type VeitDialogUnsavedChangesConfirm = {
  title: ReactNode;
  message: ReactNode;
  /** Primäre Aktion: speichern und Schließen (falls `useVeitDialogRegisterUnsavedSave` gesetzt ist). */
  saveLabel: string;
  /** Schließt nur die Bestätigung; weiter bearbeiten. */
  cancelLabel: string;
  /** Verwerfen und Hauptdialog schließen. */
  confirmLabel: string;
  closeAriaLabel?: string;
  backdropDismissLabel?: string;
  zIndexBase?: number;
  destructive?: boolean;
};

/** Fallback, wenn `unsavedChangesConfirm` nicht gesetzt ist (Apps sollten eigene Texte übergeben). */
export const VEIT_DIALOG_UNSAVED_CHANGES_DEFAULTS_EN: VeitDialogUnsavedChangesConfirm = {
  title: 'Discard changes?',
  message: 'You have unsaved changes. Save, keep editing, or discard?',
  saveLabel: 'Save',
  confirmLabel: 'Discard',
  cancelLabel: 'Keep editing',
  closeAriaLabel: 'Close',
  backdropDismissLabel: 'Close',
  destructive: true,
};

/**
 * Nur innerhalb von {@link VeitDialog}: ungespeicherte Änderungen für die zentrale Schließ-Bestätigung melden.
 * @param dirty `true` = es gibt Änderungen, die noch nicht gespeichert sind (wie bei {@link VeitDialogEditActionsFooter} `dirty`).
 */
export function useVeitDialogRegisterUnsavedDirty(dirty: boolean | undefined): void {
  const register = useContext(VeitDialogUnsavedDirtyRegistrationContext);
  useLayoutEffect(() => {
    if (!register) return;
    register(dirty === true);
    return () => {
      register(false);
    };
  }, [dirty, register]);
}

/**
 * Nur innerhalb von {@link VeitDialog}: Save-Handler für das Unsaved-Popup registrieren.
 * Typisch durch {@link VeitDialogEditActionsFooter} gesetzt.
 */
export function useVeitDialogRegisterUnsavedSave(onSave: (() => void | Promise<void>) | null): void {
  const register = useContext(VeitDialogUnsavedSaveRegistrationContext);
  useLayoutEffect(() => {
    if (!register) return;
    register(onSave);
    return () => register(null);
  }, [onSave, register]);
}

/**
 * Abstand zwischen übereinanderliegenden Dialog-Ebenen: Backdrop des Kindes liegt über Panel des Parents
 * ({@link VeitDialog} nutzt `zIndexBase` für Backdrop und `zIndexBase + 5` für die Panel-Schicht).
 */
export const VEIT_DIALOG_Z_STACK_STEP = 50;

const VeitDialogZStackContext = createContext<number | null>(null);

/**
 * Empfohlener `zIndexBase` für einen weiteren `VeitDialog` / Portal, der **innerhalb** eines geöffneten
 * `VeitDialog` (oder dessen `children`-Portalen) gerendert wird. Außerhalb eines Eltern-Dialogs: `undefined`.
 */
export function useVeitDialogNestedZIndexBase(): number | undefined {
  const v = useContext(VeitDialogZStackContext);
  return v ?? undefined;
}

/**
 * Use in custom `footer` or body actions so „Abbrechen“ dasselbe Verhalten wie X/Backdrop hat
 * (`history.back()` inkl. überlagerter Dialoge).
 * Must be called from a component rendered inside `VeitDialog`.
 */
export function useVeitDialogDismiss(): () => void {
  const d = useContext(VeitDialogDismissContext);
  if (!d) {
    throw new Error('useVeitDialogDismiss must be used inside VeitDialog');
  }
  return d;
}

type HistoryCloseFn = () => void;
type HistoryEntryMode = 'push' | 'coalesce';
const dialogHistoryStack: HistoryCloseFn[] = [];
const dialogHistoryEntryMode = new Map<HistoryCloseFn, HistoryEntryMode>();
let dialogPopStateAttached = false;
let dialogPopStateSeq = 0;
/** `dialogHistorySyncBack`: History ohne `onClose` — nächstes `popstate` ignorieren. */
let dialogSuppressNextPopHandler = false;

const MAX_DIALOG_HISTORY_CHAIN = 48;

/** In der Browser-Konsole: `localStorage.setItem('VEIT_DIALOG_HISTORY_DEBUG','1')` dann Seite neu laden. */
export function veitDialogHistoryDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('VEIT_DIALOG_HISTORY_DEBUG') === '1';
  } catch {
    return false;
  }
}

function veitDialogHistorySnapshot(): Record<string, unknown> {
  if (typeof window === 'undefined') {
    return { href: '', historyLength: -1, stateKeys: [] as string[] };
  }
  const s = window.history.state;
  const stateKeys =
    s != null && typeof s === 'object' && !Array.isArray(s) ? Object.keys(s as Record<string, unknown>) : [];
  return {
    href: window.location.href,
    historyLength: window.history.length,
    stateKeys,
  };
}

export function veitDialogHistoryLog(
  phase: string,
  detail: Record<string, unknown> & { instanceId?: string; historyStateKey?: string },
) {
  if (!veitDialogHistoryDebugEnabled()) return;
  console.log('[VeitDialog:history]', phase, {
    ...detail,
    stackLen: dialogHistoryStack.length,
    ...veitDialogHistorySnapshot(),
  });
}

function attachGlobalDialogPopState() {
  if (dialogPopStateAttached || typeof window === 'undefined') return;
  dialogPopStateAttached = true;
  window.addEventListener('popstate', () => {
    dialogPopStateSeq++;
    if (dialogSuppressNextPopHandler) {
      dialogSuppressNextPopHandler = false;
      veitDialogHistoryLog('popstate.suppressedSyncBack', {});
      return;
    }
    const beforeLen = dialogHistoryStack.length;
    const close = dialogHistoryStack.pop();
    veitDialogHistoryLog('popstate', {
      stackLenBeforePop: beforeLen,
      hadCloseHandler: Boolean(close),
    });
    close?.();
  });
}

/**
 * Neuen History-Eintrag für einen Dialog bauen: bisherigen `history.state` flach übernehmen
 * (z. B. React Router), damit `history.back()` beim Schließen nicht die vorherige Ebene
 * „leer“ wiederherstellt und z. B. `?card=` / `?event=` verloren geht.
 */
function buildDialogHistoryStateEntry(historyStateKey: string): unknown {
  const raw = typeof window !== 'undefined' ? window.history.state : null;
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>), [historyStateKey]: true };
  }
  return { [historyStateKey]: true };
}

function dialogHistoryPush(close: HistoryCloseFn, historyStateKey: string, mode: HistoryEntryMode = 'push'): void {
  attachGlobalDialogPopState();
  dialogHistoryStack.push(close);
  dialogHistoryEntryMode.set(close, mode);
  const state = buildDialogHistoryStateEntry(historyStateKey);
  if (mode === 'coalesce') {
    window.history.replaceState(state, '', window.location.href);
    veitDialogHistoryLog('replaceState.coalesce', { historyStateKey, stackLenAfterPush: dialogHistoryStack.length });
    return;
  }
  window.history.pushState(state, '', window.location.href);
  veitDialogHistoryLog('pushState', { historyStateKey, stackLenAfterPush: dialogHistoryStack.length });
}

function dialogHistoryRemove(close: HistoryCloseFn): void {
  const i = dialogHistoryStack.lastIndexOf(close);
  if (i !== -1) dialogHistoryStack.splice(i, 1);
  dialogHistoryEntryMode.delete(close);
}

function historyStateHasDialogMarker(historyStateKey: string): boolean {
  if (typeof window === 'undefined') return false;
  const s = window.history.state;
  return (
    s != null &&
    typeof s === 'object' &&
    !Array.isArray(s) &&
    (s as Record<string, unknown>)[historyStateKey] === true
  );
}

/**
 * History-Eintrag entfernen und ggf. `history.back()` — ohne `onClose` (Cleanup / Parent hat Dialog schon zu).
 */
function dialogHistorySyncBack(close: HistoryCloseFn, historyStateKey: string): void {
  const mode = dialogHistoryEntryMode.get(close) ?? 'push';
  dialogHistoryRemove(close);
  if (typeof window === 'undefined') return;
  if (mode === 'coalesce') {
    if (historyStateHasDialogMarker(historyStateKey)) {
      veitDialogHistoryLog('syncBack.coalesce.historyBack', { historyStateKey });
      dialogSuppressNextPopHandler = true;
      window.history.back();
    }
    return;
  }
  if (historyStateHasDialogMarker(historyStateKey)) {
    veitDialogHistoryLog('syncBack.historyBack', { historyStateKey });
    dialogSuppressNextPopHandler = true;
    window.history.back();
  }
}

function isTopDialogHistoryEntry(close: HistoryCloseFn): boolean {
  const n = dialogHistoryStack.length;
  return n > 0 && dialogHistoryStack[n - 1] === close;
}

/**
 * Entfernt die History-Ebene dieses Dialogs. Liegt der Eintrag nicht oben auf dem Stack
 * (überlagernde Dialoge), werden zuerst die oberen Ebenen per `history.back()` abgebaut.
 */
function navigateHistoryToClose(close: HistoryCloseFn, historyStateKey: string): void {
  if (typeof window === 'undefined') return;
  let guard = 0;
  let waitingForPopSeq: number | null = null;
  const step = () => {
    if (++guard > MAX_DIALOG_HISTORY_CHAIN) {
      veitDialogHistoryLog('navigateHistoryToClose.abortGuard', { guard });
      dialogHistoryRemove(close);
      if (historyStateHasDialogMarker(historyStateKey)) {
        dialogSuppressNextPopHandler = true;
        window.history.back();
      }
      return;
    }
    if (waitingForPopSeq !== null) {
      if (dialogPopStateSeq === waitingForPopSeq) {
        // Noch kein popstate angekommen → nicht erneut history.back feuern.
        setTimeout(step, 8);
        return;
      }
      waitingForPopSeq = null;
    }
    const idx = dialogHistoryStack.lastIndexOf(close);
    if (idx === -1) {
      veitDialogHistoryLog('navigateHistoryToClose.skipNotOnStack', { guard });
      return;
    }
    const top = isTopDialogHistoryEntry(close);
    veitDialogHistoryLog('navigateHistoryToClose.historyBack', { guard, idx, isTop: top });
    if (top) {
      window.history.back();
      return;
    }
    window.history.back();
    waitingForPopSeq = dialogPopStateSeq;
    setTimeout(step, 8);
  };
  step();
}

/** Passed to `footer` when it is a render function; same behavior as {@link useVeitDialogDismiss}. */
export type VeitDialogFooterContext = {
  dismiss: () => void;
};

export type VeitDialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Node id for `aria-describedby` (e.g. alert body). */
  ariaDescribedBy?: string;
  children: ReactNode;
  footer?: ReactNode | ((ctx: VeitDialogFooterContext) => ReactNode);
  closeAriaLabel: string;
  /**
   * Optional: `aria-label` nur für die Vollflächen-Backdrop-Schicht (Klick außerhalb).
   * Standard: gleich {@link closeAriaLabel} (auch für den X-Button).
   */
  backdropDismissLabel?: string;
  /**
   * Z-Index der Backdrop-Schicht; Panel liegt bei `zIndexBase + 5`.
   * Weglassen: übernimmt automatisch einen Wert über dem **direkt** umgebenden `VeitDialog` (Verschachtelung).
   */
  zIndexBase?: number;
  blockBackdropClose?: boolean;
  /** Disables Escape and backdrop close (e.g. while saving). */
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** `responsive`: sheet on mobile, centered from sm; `centered`: always centered. */
  variant?: 'responsive' | 'centered';
  role?: 'dialog' | 'alertdialog';
  showCloseButton?: boolean;
  backdropBlur?: boolean;
  backdropClassName?: string;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  titleClassName?: string;
  /**
   * Property name on `history.state` for our `pushState` entries (default {@link VEIT_DIALOG_DEFAULT_HISTORY_KEY}).
   */
  historyStateKey?: string;
  /**
   * `coalesce`: Dialog-Marker per `replaceState` auf den aktuellen History-Eintrag legen (kein extra `pushState`).
   * Für Deep-Links: zuerst URL per `navigate`/`setSearchParams` **pushen**, dann Dialog mit `historyCoalesce` öffnen —
   * ein `history.back()` schließt Dialog und URL-Parameter zusammen.
   */
  historyCoalesce?: boolean;
  /**
   * `false`: Body fest ohne vertikales Scroll (z. B. Zeiträder). Wenn `true`: vertikales Scrollen nur,
   * wenn Inhalt wirklich höher als der Body — kein dauerhaftes `overflow-y:auto` (vermeidet Geister-Scrollbalken).
   */
  bodyScrollable?: boolean;
  /**
   * `modal` (default): zentriert oder responsives Sheet mit Vollbild-Backdrop.
   * `bottom`: Panel unten ohne Backdrop — Hintergrund (z. B. Karte) bleibt bedienbar.
   * Dann werden `variant` / `size` für die Panel-Form ignoriert (volle Breite).
   */
  presentation?: 'modal' | 'bottom';
  /**
   * Nur `presentation="bottom"`: Ziel für `createPortal`. Standard `document.body` mit `fixed`.
   * Bei z. B. `position: relative`-Rahmen (eingebettete Karte) Element übergeben → Sheet mit `absolute`.
   */
  bottomDockRoot?: HTMLElement | null;
  /**
   * Texte für die Bestätigung beim Schließen mit ungespeicherten Änderungen.
   * Registrierung über {@link VeitDialogEditActionsFooter} (`dirty`) oder
   * {@link useVeitDialogRegisterUnsavedDirty} / {@link useVeitDialogRegisterUnsavedSave}.
   * `undefined`: Fallback {@link VEIT_DIALOG_UNSAVED_CHANGES_DEFAULTS_EN}; `null`: Abfrage aus.
   */
  unsavedChangesConfirm?: VeitDialogUnsavedChangesConfirm | null;
};

export function VeitDialogCloseButton({
  onClick,
  label,
  disabled,
  className = '',
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-border/80 bg-background text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:pointer-events-none disabled:opacity-40 ${className}`.trim()}
    >
      <X className="h-5 w-5" strokeWidth={2} aria-hidden />
    </button>
  );
}

export function VeitDialog({
  open,
  onClose,
  title,
  description,
  ariaDescribedBy,
  children,
  footer,
  closeAriaLabel,
  backdropDismissLabel,
  zIndexBase: zIndexBaseProp,
  blockBackdropClose = false,
  disabled = false,
  size = 'md',
  variant = 'responsive',
  role = 'dialog',
  showCloseButton = true,
  backdropBlur = true,
  backdropClassName,
  className = '',
  bodyClassName = '',
  headerClassName = '',
  titleClassName = '',
  historyStateKey = VEIT_DIALOG_DEFAULT_HISTORY_KEY,
  historyCoalesce = false,
  bodyScrollable = true,
  presentation = 'modal',
  bottomDockRoot = null,
  unsavedChangesConfirm,
}: VeitDialogProps) {
  const resolvedUnsavedConfirm =
    unsavedChangesConfirm === null
      ? null
      : (unsavedChangesConfirm ?? VEIT_DIALOG_UNSAVED_CHANGES_DEFAULTS_EN);

  const unsavedDirtyRef = useRef(false);
  const registerUnsavedDirty = useCallback((v: boolean) => {
    unsavedDirtyRef.current = v;
  }, []);

  const unsavedSaveRef = useRef<(() => void | Promise<void>) | null>(null);
  const registerUnsavedSave = useCallback((fn: (() => void | Promise<void>) | null) => {
    unsavedSaveRef.current = fn;
  }, []);

  const [unsavedPromptOpen, setUnsavedPromptOpen] = useState(false);

  useEffect(() => {
    if (!open) setUnsavedPromptOpen(false);
  }, [open]);

  const backdropAriaLabel = backdropDismissLabel ?? closeAriaLabel;
  const autoTitleId = useId();
  const autoDescId = useId();
  const titleId = autoTitleId;
  const headerDescriptionId = description != null ? autoDescId : undefined;
  const describedBy = [ariaDescribedBy, headerDescriptionId].filter(Boolean).join(' ') || undefined;
  const [mounted, setMounted] = useState(false);
  /** Dialog-Body: `overflow-y` nur bei echtem Überlauf — vermeidet „Geister“-Scrollbalken (Subpixel/Flex). */
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyHasVerticalScrollRef = useRef(false);
  const [bodyHasVerticalScroll, setBodyHasVerticalScroll] = useState(false);

  const parentNestedZ = useContext(VeitDialogZStackContext);
  const resolvedZIndexBase = zIndexBaseProp ?? parentNestedZ ?? 200;
  const nestedZForChildren = resolvedZIndexBase + VEIT_DIALOG_Z_STACK_STEP;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  /**
   * `performDismiss` ruft `navigateHistoryToClose` → `history.back()`. React kann im selben Commit
   * den `useLayoutEffect`-Cleanup ausführen, bevor `popstate` den Stack geleert hat — dann würde das
   * Cleanup ein zweites `history.back()` auslösen. Pending bleibt true bis {@link stableClose} (popstate).
   */
  const performDismissHistoryBackPendingRef = useRef(false);

  /** Stabile Identität pro Dialog-Instanz — der Stack vergleicht Referenzen. */
  const stableCloseRef = useRef<HistoryCloseFn | null>(null);
  if (stableCloseRef.current === null) {
    stableCloseRef.current = () => {
      /** Vom globalen `popstate` nach `history.back()` — Pending hier lösen, nicht per setTimeout. */
      performDismissHistoryBackPendingRef.current = false;
      onCloseRef.current();
    };
  }
  const stableClose = stableCloseRef.current;

  const debugInstanceIdRef = useRef(`dlg-${Math.random().toString(36).slice(2, 9)}`);

  const historyPathKeyWhenOpenedRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || typeof window === 'undefined') return;
    veitDialogHistoryLog('effect.mountPush', {
      instanceId: debugInstanceIdRef.current,
      historyStateKey,
      open,
    });
    dialogHistoryPush(stableClose, historyStateKey, historyCoalesce ? 'coalesce' : 'push');
    historyPathKeyWhenOpenedRef.current = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    return () => {
      const pathKeyWhenOpened = historyPathKeyWhenOpenedRef.current;
      historyPathKeyWhenOpenedRef.current = null;
      if (typeof window === 'undefined') return;
      const pathKeyNow = `${window.location.origin}${window.location.pathname}${window.location.search}`;
      const onStack = dialogHistoryStack.lastIndexOf(stableClose);
      veitDialogHistoryLog('effect.cleanup', {
        instanceId: debugInstanceIdRef.current,
        historyStateKey,
        pathKeyWhenOpened,
        pathKeyNow,
        pathMismatch: pathKeyWhenOpened !== null && pathKeyNow !== pathKeyWhenOpened,
        onStackIdx: onStack,
      });
      if (performDismissHistoryBackPendingRef.current) {
        if (onStack !== -1) {
          performDismissHistoryBackPendingRef.current = false;
          veitDialogHistoryLog('effect.cleanup.pendingSyncBack', { instanceId: debugInstanceIdRef.current });
          dialogHistorySyncBack(stableClose, historyStateKey);
        } else {
          veitDialogHistoryLog('effect.cleanup.skipNavigatePerformDismissPending', {
            instanceId: debugInstanceIdRef.current,
          });
        }
        return;
      }
      if (onStack === -1) {
        if (historyStateHasDialogMarker(historyStateKey)) {
          veitDialogHistoryLog('effect.cleanup.orphanMarkerSyncBack', { instanceId: debugInstanceIdRef.current });
          dialogSuppressNextPopHandler = true;
          window.history.back();
        } else {
          veitDialogHistoryLog('effect.cleanup.skipNavigateNotOnStack', { instanceId: debugInstanceIdRef.current });
        }
        return;
      }
      veitDialogHistoryLog('effect.cleanup.dialogHistorySyncBack', { instanceId: debugInstanceIdRef.current });
      dialogHistorySyncBack(stableClose, historyStateKey);
    };
  }, [open, historyStateKey, historyCoalesce, stableClose]);

  const performDismiss = useCallback(() => {
    veitDialogHistoryLog('performDismiss.enter', {
      instanceId: debugInstanceIdRef.current,
      historyStateKey,
    });
    if (typeof window === 'undefined') {
      onClose();
      return;
    }
    if (dialogHistoryStack.lastIndexOf(stableClose) === -1) {
      veitDialogHistoryLog('performDismiss.onCloseNotOnStack', { instanceId: debugInstanceIdRef.current });
      onClose();
      return;
    }
    veitDialogHistoryLog('performDismiss.navigateHistoryToClose', { instanceId: debugInstanceIdRef.current });
    performDismissHistoryBackPendingRef.current = true;
    navigateHistoryToClose(stableClose, historyStateKey);
  }, [onClose, stableClose, historyStateKey]);

  const attemptDismiss = useCallback(() => {
    if (unsavedDirtyRef.current && resolvedUnsavedConfirm) {
      setUnsavedPromptOpen(true);
      return;
    }
    performDismiss();
  }, [resolvedUnsavedConfirm, performDismiss]);

  /**
   * Wisch-zum-Schließen: bei offenen Änderungen zuerst denselben Speichern-Pfad wie der primäre
   * Speichern-Button ({@link useVeitDialogRegisterUnsavedSave} / {@link VeitDialogEditActionsFooter}),
   * statt sofort den „Ungespeichert“-Dialog zu öffnen.
   */
  const attemptSwipeDismiss = useCallback(() => {
    if (unsavedDirtyRef.current && unsavedSaveRef.current) {
      const fn = unsavedSaveRef.current;
      void (async () => {
        try {
          await Promise.resolve(fn());
        } catch {
          // wie Fußzeilen-Speichern: Fehler → Dialog bleibt offen
          return;
        }
        /**
         * Kein `performDismiss()` hier: Speichern kann den Dialog asynchron schließen
         * (wie beim Klick auf Speichern in der Fußzeile).
         */
      })();
      return;
    }
    attemptDismiss();
  }, [attemptDismiss]);

  const dismissFromOverlay = useCallback(() => {
    if (disabled || blockBackdropClose) return;
    attemptDismiss();
  }, [disabled, blockBackdropClose, attemptDismiss]);

  const dismissFromCloseButton = useCallback(() => {
    if (disabled) return;
    attemptDismiss();
  }, [disabled, attemptDismiss]);

  const swipeDismissDisabled = disabled || blockBackdropClose;
  useVeitDialogSwipeDismissEffect({
    open: open && mounted,
    swipeDisabled: swipeDismissDisabled,
    bodyHasVerticalScroll: bodyScrollable && bodyHasVerticalScroll,
    attemptDismiss: attemptSwipeDismiss,
    panelRef,
    headerRef,
    bodyScrollRef,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || disabled) return;
      if (!isTopDialogHistoryEntry(stableClose)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      dismissFromOverlay();
    };
    // Capture: vor Bubble-Listenern (z. B. Karten-UI), damit Escape nicht „durchrutscht“.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, disabled, dismissFromOverlay, stableClose]);

  useLayoutEffect(() => {
    if (!open || !mounted || !bodyScrollable || typeof window === 'undefined') return;
    const el = bodyScrollRef.current;
    if (!el) return;

    const padPx = 2;
    const sync = () => {
      const needs = el.scrollHeight > el.clientHeight + padPx;
      el.style.overflowY = needs ? 'auto' : 'hidden';
      el.style.overflowX = 'hidden';
      el.style.touchAction = needs ? 'pan-y' : '';
      bodyHasVerticalScrollRef.current = needs;
      setBodyHasVerticalScroll(needs);
    };

    sync();

    const ro = new ResizeObserver(() => {
      queueMicrotask(sync);
    });
    ro.observe(el);
    for (const c of el.children) {
      ro.observe(c);
    }
    const mo = new MutationObserver(() => {
      queueMicrotask(sync);
    });
    mo.observe(el, { subtree: true, childList: true, characterData: true, attributes: true });
    window.addEventListener('resize', sync);

    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', sync);
      el.style.overflowY = '';
      el.style.overflowX = '';
      el.style.touchAction = '';
      bodyHasVerticalScrollRef.current = false;
      setBodyHasVerticalScroll(false);
    };
  }, [open, mounted, bodyScrollable, presentation]);

  const unsavedPromptEl =
    resolvedUnsavedConfirm != null ? (
      <VeitDialog
        open={unsavedPromptOpen}
        onClose={() => setUnsavedPromptOpen(false)}
        title={resolvedUnsavedConfirm.title}
        closeAriaLabel={
          resolvedUnsavedConfirm.closeAriaLabel ?? resolvedUnsavedConfirm.cancelLabel
        }
        backdropDismissLabel={
          resolvedUnsavedConfirm.backdropDismissLabel ?? resolvedUnsavedConfirm.cancelLabel
        }
        zIndexBase={resolvedUnsavedConfirm.zIndexBase}
        unsavedChangesConfirm={null}
        variant="centered"
        size="md"
        footer={({ dismiss }) => (
          <VeitDialogFooter className="sm:flex-nowrap">
            <button type="button" className="btn-secondary" onClick={dismiss}>
              {resolvedUnsavedConfirm.cancelLabel}
            </button>
            <button
              type="button"
              className="btn-destructive"
              onClick={() => {
                /**
                 * Kein eigenes `dismiss()` hier: `performDismiss()` schließt den Hauptdialog via History
                 * und baut dabei ggf. zuerst darüberliegende Dialoge (wie dieses Prompt) ab.
                 * Ein zusätzliches `dismiss()` würde sonst ein doppeltes `history.back()` erzeugen.
                 */
                performDismiss();
              }}
            >
              {resolvedUnsavedConfirm.confirmLabel}
            </button>
            <button
              type="button"
              className="btn-primary"
              autoFocus={unsavedSaveRef.current != null}
              disabled={unsavedSaveRef.current == null}
              onClick={() => {
                dismiss();
                void (async () => {
                  const fn = unsavedSaveRef.current;
                  if (!fn) return;
                  try {
                    await Promise.resolve(fn());
                  } catch {
                    // Bleibt im Hauptdialog; Nutzer kann weiter bearbeiten / erneut versuchen.
                    return;
                  }
                  /**
                   * Nicht automatisch schließen: je nach Save-Implementierung (z. B. `requestSubmit`)
                   * wird der Dialog asynchron nach erfolgreichem Speichern selbst geschlossen.
                   * Ein sofortiges `performDismiss()` würde sonst ein zusätzliches `history.back()`
                   * auslösen und „zu weit zurück“ navigieren.
                   */
                })();
              }}
            >
              {resolvedUnsavedConfirm.saveLabel}
            </button>
          </VeitDialogFooter>
        )}
      >
        <div className="text-sm text-muted-foreground">{resolvedUnsavedConfirm.message}</div>
      </VeitDialog>
    ) : null;

  if (!open || !mounted) return null;

  const footerNode =
    typeof footer === 'function' ? footer({ dismiss: dismissFromCloseButton }) : footer;

  const zBack = resolvedZIndexBase;
  const zLayer = resolvedZIndexBase + 5;
  const inactive = disabled || blockBackdropClose;

  const portalTarget =
    typeof document === 'undefined'
      ? null
      : presentation === 'bottom'
        ? bottomDockRoot ?? document.body
        : document.body;

  if (portalTarget == null) return null;

  const titleBlock = (
    <div className="min-w-0 flex-1">
      <div
        id={titleId}
        className={
          titleClassName.trim() ||
          'text-lg font-semibold tracking-tight text-foreground sm:text-xl'
        }
      >
        {title}
      </div>
      {description != null ? (
        <div id={headerDescriptionId} className="mt-1.5 text-sm text-muted-foreground">
          {description}
        </div>
      ) : null}
    </div>
  );

  if (presentation === 'bottom') {
    const dockUsesFixed = portalTarget === document.body;
    const posClass = dockUsesFixed ? 'fixed bottom-0 left-0 right-0' : 'absolute bottom-0 left-0 right-0';
    const bottomShellClass =
      `flex flex-col w-full ${DIALOG_BOTTOM_DOCK_MAX_H} overflow-hidden rounded-t-2xl border-t border-border bg-background text-foreground shadow-[0_-4px_20px_rgba(0,0,0,0.12)] ${className}`.trim();

    const node = (
      <VeitDialogZStackContext.Provider value={nestedZForChildren}>
        <VeitDialogUnsavedDirtyRegistrationContext.Provider value={registerUnsavedDirty}>
          <VeitDialogUnsavedSaveRegistrationContext.Provider value={registerUnsavedSave}>
          <VeitDialogDismissContext.Provider value={dismissFromCloseButton}>
            <div
              ref={panelRef}
              role={role}
              aria-modal="false"
              aria-labelledby={titleId}
              aria-describedby={describedBy}
              className={`${posClass} flex flex-col ${bottomShellClass}`}
              style={{ zIndex: zLayer }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                ref={headerRef}
                className={`flex shrink-0 items-start justify-between gap-3 border-b border-border/60 bg-background px-5 pb-4 pt-3 sm:px-6 ${headerClassName}`.trim()}
              >
                {titleBlock}
                {showCloseButton ? (
                  <VeitDialogCloseButton onClick={dismissFromCloseButton} label={closeAriaLabel} disabled={disabled} />
                ) : null}
              </div>
              <div
                ref={bodyScrollRef}
                className={`min-h-0 grow-0 shrink overflow-x-hidden overflow-y-hidden bg-background px-5 py-4 sm:px-6 sm:py-5 ${bodyClassName}`.trim()}
              >
                {children}
              </div>
              {footerNode != null ? (
                <div className="shrink-0 border-t border-border/50 bg-background px-5 py-4 sm:px-6 sm:py-5">
                  {footerNode}
                </div>
              ) : null}
            </div>
            {unsavedPromptEl}
          </VeitDialogDismissContext.Provider>
          </VeitDialogUnsavedSaveRegistrationContext.Provider>
        </VeitDialogUnsavedDirtyRegistrationContext.Provider>
      </VeitDialogZStackContext.Provider>
    );

    return createPortal(node, portalTarget);
  }

  const overlayAlign =
    variant === 'centered'
      ? 'items-center justify-center p-4'
      : 'items-end justify-center p-0 sm:items-center sm:p-4';

  const panelShape =
    variant === 'centered'
      ? `${DIALOG_PANEL_MAX_H} w-full ${sizeMax[size]} overflow-hidden rounded-2xl border border-border/80 bg-surface text-foreground shadow-2xl`
      : `${DIALOG_PANEL_MAX_H} w-full ${sizeMax[size]} overflow-hidden rounded-t-[1.25rem] border border-border/80 bg-surface text-foreground shadow-2xl sm:rounded-2xl`;

  const node = (
    <VeitDialogZStackContext.Provider value={nestedZForChildren}>
      <VeitDialogUnsavedDirtyRegistrationContext.Provider value={registerUnsavedDirty}>
        <VeitDialogUnsavedSaveRegistrationContext.Provider value={registerUnsavedSave}>
        <VeitDialogDismissContext.Provider value={dismissFromCloseButton}>
          <>
            <button
              type="button"
              className={`fixed inset-0 ${backdropClassName ?? 'bg-black/50'} ${backdropBlur ? 'backdrop-blur-[2px]' : ''}`.trim()}
              style={{ zIndex: zBack }}
              aria-label={backdropAriaLabel}
              disabled={inactive}
              onClick={() => {
                if (!inactive) dismissFromOverlay();
              }}
            />
            <div
              className={`pointer-events-none fixed inset-0 flex ${overlayAlign}`}
              style={{ zIndex: zLayer }}
              role="presentation"
            >
              <div
                ref={panelRef}
                role={role}
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={describedBy}
                className={`pointer-events-auto flex flex-col ${panelShape} ${className}`.trim()}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  ref={headerRef}
                  className={`flex shrink-0 items-start justify-between gap-3 border-b border-border/60 bg-surface px-5 pb-4 pt-5 sm:px-6 ${headerClassName}`.trim()}
                >
                  {titleBlock}
                  {showCloseButton ? (
                    <VeitDialogCloseButton onClick={dismissFromCloseButton} label={closeAriaLabel} disabled={disabled} />
                  ) : null}
                </div>
                <div
                  ref={bodyScrollRef}
                  className={`min-h-0 grow-0 shrink overflow-x-hidden overflow-y-hidden bg-surface px-5 py-4 sm:px-6 sm:py-5 ${bodyClassName}`.trim()}
                >
                  {children}
                </div>
                {footerNode != null ? (
                  <div className="shrink-0 border-t border-border/50 bg-surface px-5 py-4 sm:px-6 sm:py-5">
                    {footerNode}
                  </div>
                ) : null}
              </div>
            </div>
            {unsavedPromptEl}
          </>
        </VeitDialogDismissContext.Provider>
        </VeitDialogUnsavedSaveRegistrationContext.Provider>
      </VeitDialogUnsavedDirtyRegistrationContext.Provider>
    </VeitDialogZStackContext.Provider>
  );

  return createPortal(node, portalTarget);
}

export function VeitDialogFooter({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col-reverse gap-2.5 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
