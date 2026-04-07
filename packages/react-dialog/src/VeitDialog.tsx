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

/** Default `history.pushState` marker property for dialog entries. */
export const VEIT_DIALOG_DEFAULT_HISTORY_KEY = 'veit_dialog';

const VeitDialogDismissContext = createContext<(() => void) | null>(null);

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

function attachGlobalDialogPopState() {
  if (dialogPopStateAttached || typeof window === 'undefined') return;
  dialogPopStateAttached = true;
  window.addEventListener('popstate', () => {
    const close = dialogHistoryStack.pop();
    close?.();
  });
}

function dialogHistoryPush(close: HistoryCloseFn, historyStateKey: string): void {
  attachGlobalDialogPopState();
  dialogHistoryStack.push(close);
  window.history.pushState({ [historyStateKey]: true }, '', window.location.href);
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
      dialogHistoryRemove(close);
      return;
    }
    const idx = dialogHistoryStack.lastIndexOf(close);
    if (idx === -1) return;
    if (isTopDialogHistoryEntry(close)) {
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
   * `false`: body does not scroll (`overflow-y-auto` omitted). Use when inner regions handle scroll
   * (e.g. time wheels) so touch gestures do not stick to the dialog body.
   */
  bodyScrollable?: boolean;
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
  zIndexBase = 200,
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
}: VeitDialogProps) {
  const autoTitleId = useId();
  const autoDescId = useId();
  const titleId = autoTitleId;
  const headerDescriptionId = description != null ? autoDescId : undefined;
  const describedBy = [ariaDescribedBy, headerDescriptionId].filter(Boolean).join(' ') || undefined;
  const [mounted, setMounted] = useState(false);

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

  const historyPathKeyWhenOpenedRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || typeof window === 'undefined') return;
    dialogHistoryPush(stableClose, historyStateKey);
    historyPathKeyWhenOpenedRef.current = `${window.location.origin}${window.location.pathname}`;
    return () => {
      const pathKeyWhenOpened = historyPathKeyWhenOpenedRef.current;
      historyPathKeyWhenOpenedRef.current = null;
      if (typeof window === 'undefined') return;
      const pathKeyNow = `${window.location.origin}${window.location.pathname}`;
      if (pathKeyWhenOpened !== null && pathKeyNow !== pathKeyWhenOpened) {
        dialogHistoryRemove(stableClose);
        return;
      }
      if (dialogHistoryStack.lastIndexOf(stableClose) === -1) return;
      navigateHistoryToClose(stableClose);
    };
  }, [open, historyStateKey, stableClose]);

  const performDismiss = useCallback(() => {
    if (typeof window === 'undefined') {
      onClose();
      return;
    }
    if (dialogHistoryStack.lastIndexOf(stableClose) === -1) {
      onClose();
      return;
    }
    navigateHistoryToClose(stableClose);
  }, [onClose, stableClose]);

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
      if (e.key === 'Escape' && !disabled) dismissFromOverlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, disabled, dismissFromOverlay]);

  if (!open || !mounted) return null;

  const footerNode =
    typeof footer === 'function' ? footer({ dismiss: dismissFromCloseButton }) : footer;

  const zBack = zIndexBase;
  const zLayer = zIndexBase + 5;
  const inactive = disabled || blockBackdropClose;

  const overlayAlign =
    variant === 'centered'
      ? 'items-center justify-center p-4'
      : 'items-end justify-center p-0 sm:items-center sm:p-4';

  const panelShape =
    variant === 'centered'
      ? `max-h-[min(88vh,720px)] w-full ${sizeMax[size]} overflow-hidden rounded-2xl border border-border/80 bg-surface text-foreground shadow-2xl`
      : `max-h-[min(92dvh,720px)] w-full ${sizeMax[size]} overflow-hidden rounded-t-[1.25rem] border border-border/80 bg-surface text-foreground shadow-2xl sm:rounded-2xl`;

  const node = (
    <VeitDialogDismissContext.Provider value={dismissFromCloseButton}>
      <>
      <button
        type="button"
        className={`fixed inset-0 ${backdropClassName ?? 'bg-black/50'} ${backdropBlur ? 'backdrop-blur-[2px]' : ''}`.trim()}
        style={{ zIndex: zBack }}
        aria-label={closeAriaLabel}
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
            {showCloseButton ? (
              <VeitDialogCloseButton onClick={dismissFromCloseButton} label={closeAriaLabel} disabled={disabled} />
            ) : null}
          </div>
          <div
            className={`min-h-0 flex-1 bg-surface px-5 py-4 sm:px-6 sm:py-5 ${
              bodyScrollable ? 'overflow-y-auto' : 'overflow-x-hidden overflow-y-hidden'
            } ${bodyClassName}`.trim()}
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
  );

  return createPortal(node, document.body);
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
