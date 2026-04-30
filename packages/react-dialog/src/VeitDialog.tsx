import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
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

/** Default `history.pushState` marker property for dialog entries. */
export const VEIT_DIALOG_DEFAULT_HISTORY_KEY = 'veit_dialog';

const VeitDialogDismissContext = createContext<(() => void) | null>(null);

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
const dialogHistoryStack: HistoryCloseFn[] = [];
let dialogPopStateAttached = false;

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
  detail: Record<string, unknown> & { instanceId?: string; historyStateKey?: string; historyStackMode?: string },
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

function dialogHistoryPush(close: HistoryCloseFn, historyStateKey: string): void {
  attachGlobalDialogPopState();
  dialogHistoryStack.push(close);
  window.history.pushState(buildDialogHistoryStateEntry(historyStateKey), '', window.location.href);
  veitDialogHistoryLog('pushState', { historyStateKey, stackLenAfterPush: dialogHistoryStack.length });
}

function dialogHistoryRemove(close: HistoryCloseFn): void {
  const i = dialogHistoryStack.lastIndexOf(close);
  if (i !== -1) dialogHistoryStack.splice(i, 1);
}

function isTopDialogHistoryEntry(close: HistoryCloseFn): boolean {
  const n = dialogHistoryStack.length;
  return n > 0 && dialogHistoryStack[n - 1] === close;
}

/**
 * Entfernt die History-Ebene dieses Dialogs. Liegt der Eintrag nicht oben auf dem Stack
 * (überlagernde Dialoge), werden zuerst die oberen Ebenen per `history.back()` abgebaut.
 */
function navigateHistoryToClose(close: HistoryCloseFn): void {
  if (typeof window === 'undefined') return;
  let guard = 0;
  const step = () => {
    if (++guard > MAX_DIALOG_HISTORY_CHAIN) {
      veitDialogHistoryLog('navigateHistoryToClose.abortGuard', { guard });
      dialogHistoryRemove(close);
      return;
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
    setTimeout(step, 0);
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
   * `false`: Body fest ohne vertikales Scroll (z. B. Zeiträder). Wenn `true`: vertikales Scrollen nur,
   * wenn Inhalt wirklich höher als der Body — kein dauerhaftes `overflow-y:auto` (vermeidet Geister-Scrollbalken).
   */
  bodyScrollable?: boolean;
  /**
   * `internal` (default): eigene History-Ebene per `pushState` für Zurück/Stapel (wie bisher).
   * `none`: kein zusätzlicher History-Eintrag — für Overlays, deren Zustand bereits über die URL
   * (z. B. React Router `?event=` / `?card=`) geführt wird, damit nicht doppelt geschichtet wird.
   */
  historyStackMode?: 'internal' | 'none';
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
  bodyScrollable = true,
  historyStackMode = 'internal',
  presentation = 'modal',
  bottomDockRoot = null,
}: VeitDialogProps) {
  const backdropAriaLabel = backdropDismissLabel ?? closeAriaLabel;
  const autoTitleId = useId();
  const autoDescId = useId();
  const titleId = autoTitleId;
  const headerDescriptionId = description != null ? autoDescId : undefined;
  const describedBy = [ariaDescribedBy, headerDescriptionId].filter(Boolean).join(' ') || undefined;
  const [mounted, setMounted] = useState(false);
  /** Dialog-Body: `overflow-y` nur bei echtem Überlauf — vermeidet „Geister“-Scrollbalken (Subpixel/Flex). */
  const bodyScrollRef = useRef<HTMLDivElement>(null);

  const parentNestedZ = useContext(VeitDialogZStackContext);
  const resolvedZIndexBase = zIndexBaseProp ?? parentNestedZ ?? 200;
  const nestedZForChildren = resolvedZIndexBase + VEIT_DIALOG_Z_STACK_STEP;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  /** Stabile Identität pro Dialog-Instanz — der Stack vergleicht Referenzen. */
  const stableCloseRef = useRef<HistoryCloseFn | null>(null);
  if (stableCloseRef.current === null) {
    stableCloseRef.current = () => {
      onCloseRef.current();
    };
  }
  const stableClose = stableCloseRef.current;

  const debugInstanceIdRef = useRef(`dlg-${Math.random().toString(36).slice(2, 9)}`);

  const historyPathKeyWhenOpenedRef = useRef<string | null>(null);

  /**
   * `performDismiss` ruft `navigateHistoryToClose` → `history.back()`. React kann im selben Commit
   * den `useLayoutEffect`-Cleanup des noch geöffneten Dialogs ausführen, bevor `popstate` den Stack
   * geleert hat — dann würde das Cleanup ein zweites `history.back()` auslösen (z. B. `?card=` weg).
   */
  const performDismissHistoryBackPendingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const useInternalStack = historyStackMode !== 'none';
    if (useInternalStack) {
      veitDialogHistoryLog('effect.mountPush', {
        instanceId: debugInstanceIdRef.current,
        historyStateKey,
        historyStackMode,
        open,
      });
      dialogHistoryPush(stableClose, historyStateKey);
      historyPathKeyWhenOpenedRef.current = `${window.location.origin}${window.location.pathname}`;
    } else {
      historyPathKeyWhenOpenedRef.current = null;
    }
    return () => {
      if (!useInternalStack) return;
      const pathKeyWhenOpened = historyPathKeyWhenOpenedRef.current;
      historyPathKeyWhenOpenedRef.current = null;
      if (typeof window === 'undefined') return;
      const pathKeyNow = `${window.location.origin}${window.location.pathname}`;
      const onStack = dialogHistoryStack.lastIndexOf(stableClose);
      veitDialogHistoryLog('effect.cleanup', {
        instanceId: debugInstanceIdRef.current,
        historyStateKey,
        historyStackMode,
        pathKeyWhenOpened,
        pathKeyNow,
        pathMismatch: pathKeyWhenOpened !== null && pathKeyNow !== pathKeyWhenOpened,
        onStackIdx: onStack,
      });
      if (pathKeyWhenOpened !== null && pathKeyNow !== pathKeyWhenOpened) {
        dialogHistoryRemove(stableClose);
        veitDialogHistoryLog('effect.cleanup.dialogHistoryRemoveOnly', { instanceId: debugInstanceIdRef.current });
        return;
      }
      if (onStack === -1) {
        veitDialogHistoryLog('effect.cleanup.skipNavigateNotOnStack', { instanceId: debugInstanceIdRef.current });
        return;
      }
      if (performDismissHistoryBackPendingRef.current) {
        veitDialogHistoryLog('effect.cleanup.skipNavigatePerformDismissPending', {
          instanceId: debugInstanceIdRef.current,
        });
        return;
      }
      veitDialogHistoryLog('effect.cleanup.navigateHistoryToClose', { instanceId: debugInstanceIdRef.current });
      navigateHistoryToClose(stableClose);
    };
  }, [open, historyStateKey, stableClose, historyStackMode]);

  const performDismiss = useCallback(() => {
    veitDialogHistoryLog('performDismiss.enter', {
      instanceId: debugInstanceIdRef.current,
      historyStateKey,
      historyStackMode,
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
    try {
      navigateHistoryToClose(stableClose);
    } finally {
      // Nach Layout-Cleanup desselben Frames (siehe effect.cleanup), damit verschachtelte
      // `history.back()`-Ketten den Ref noch gesetzt lassen.
      queueMicrotask(() => {
        queueMicrotask(() => {
          performDismissHistoryBackPendingRef.current = false;
        });
      });
    }
  }, [onClose, stableClose, historyStateKey, historyStackMode]);

  const dismissFromOverlay = useCallback(() => {
    if (disabled || blockBackdropClose) return;
    performDismiss();
  }, [disabled, blockBackdropClose, performDismiss]);

  const dismissFromCloseButton = useCallback(() => {
    if (disabled) return;
    performDismiss();
  }, [disabled, performDismiss]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || disabled) return;
      const onStack = dialogHistoryStack.lastIndexOf(stableClose) !== -1;
      const allowEscape =
        historyStackMode === 'none'
          ? !onStack && dialogHistoryStack.length === 0
          : isTopDialogHistoryEntry(stableClose);
      if (!allowEscape) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      dismissFromOverlay();
    };
    // Capture: vor Bubble-Listenern (z. B. Karten-UI), damit Escape nicht „durchrutscht“.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, disabled, dismissFromOverlay, stableClose, historyStackMode]);

  useLayoutEffect(() => {
    if (!open || !mounted || !bodyScrollable || typeof window === 'undefined') return;
    const el = bodyScrollRef.current;
    if (!el) return;

    const padPx = 2;
    const sync = () => {
      const needs = el.scrollHeight > el.clientHeight + padPx;
      el.style.overflowY = needs ? 'auto' : 'hidden';
      el.style.overflowX = 'hidden';
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
    };
  }, [open, mounted, bodyScrollable, presentation]);

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
        <VeitDialogDismissContext.Provider value={dismissFromCloseButton}>
          <div
            role={role}
            aria-modal="false"
            aria-labelledby={titleId}
            aria-describedby={describedBy}
            className={`${posClass} flex flex-col ${bottomShellClass}`}
            style={{ zIndex: zLayer }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`flex shrink-0 items-start justify-between gap-3 border-b border-border/60 bg-background px-5 pb-4 pt-3 sm:px-6 ${headerClassName}`.trim()}
            >
              {titleBlock}
              {showCloseButton ? (
                <VeitDialogCloseButton onClick={dismissFromCloseButton} label={closeAriaLabel} disabled={disabled} />
              ) : null}
            </div>
            <div
              ref={bodyScrollable ? bodyScrollRef : undefined}
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
        </VeitDialogDismissContext.Provider>
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
              role={role}
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={describedBy}
              className={`pointer-events-auto flex flex-col ${panelShape} ${className}`.trim()}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`flex shrink-0 items-start justify-between gap-3 border-b border-border/60 bg-surface px-5 pb-4 pt-5 sm:px-6 ${headerClassName}`.trim()}
              >
                {titleBlock}
                {showCloseButton ? (
                  <VeitDialogCloseButton onClick={dismissFromCloseButton} label={closeAriaLabel} disabled={disabled} />
                ) : null}
              </div>
              <div
                ref={bodyScrollable ? bodyScrollRef : undefined}
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
        </>
      </VeitDialogDismissContext.Provider>
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
