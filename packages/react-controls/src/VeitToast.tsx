import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { veitAlertIcon, veitAlertRole, veitAlertToneClass, type VeitAlertVariant } from './VeitAlert.js';
import { VeitIconButton } from './VeitIconButton.js';

export type VeitToastKind = VeitAlertVariant;

export type VeitToastShowOptions = {
  /** Auto-dismiss after ms; 0 keeps the toast until it is closed. Default: see `durationMs` of the provider. */
  durationMs?: number;
};

export type VeitToastApi = {
  /** Shows a toast and returns its id; empty text shows nothing and returns -1. */
  show: (kind: VeitToastKind, text: string, opts?: VeitToastShowOptions) => number;
  dismiss: (id: number) => void;
};

export type VeitToastTexts = {
  /** aria-label and title of the close button. */
  close: string;
};

export type VeitToastProviderProps = {
  children: ReactNode;
  texts?: Partial<VeitToastTexts>;
  /** Default durations per kind in ms. Errors stay longer, so they can be read. */
  durationMs?: Partial<Record<VeitToastKind, number>>;
  /** `responsive`: at the bottom on phones (thumb reach), at the top from `sm` on. */
  placement?: 'responsive' | 'top' | 'bottom';
};

type ToastItem = { id: number; kind: VeitToastKind; text: string };

const DEFAULT_TEXTS: VeitToastTexts = { close: 'Schließen' };

const DEFAULT_DURATION: Record<VeitToastKind, number> = {
  success: 5000,
  info: 5000,
  warning: 7000,
  error: 9000,
};

const PLACEMENT: Record<NonNullable<VeitToastProviderProps['placement']>, string> = {
  responsive: 'bottom-4 flex-col-reverse sm:bottom-auto sm:top-6 sm:flex-col',
  top: 'top-4 flex-col sm:top-6',
  bottom: 'bottom-4 flex-col-reverse sm:bottom-6',
};

const VeitToastContext = createContext<VeitToastApi | null>(null);

function VeitToastStack({
  items,
  texts,
  placement,
  onDismiss,
}: {
  items: ToastItem[];
  texts: VeitToastTexts;
  placement: NonNullable<VeitToastProviderProps['placement']>;
  onDismiss: (id: number) => void;
}) {
  // The live region stays in the DOM, also when empty: screen readers only announce additions to a region they know.
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 z-50 flex items-center gap-2 px-4 ${PLACEMENT[placement]}`}
      aria-live="polite"
      aria-relevant="additions"
    >
      {items.map((item) => (
        // Opaque card underneath, so the tinted toast stays readable over any page content.
        <div key={item.id} role={veitAlertRole(item.kind)} className="pointer-events-auto w-full max-w-lg rounded-xl bg-card shadow-lg">
          <div className={`flex items-start gap-2 rounded-xl border px-3 py-1 text-sm ${veitAlertToneClass[item.kind]}`}>
            <span className="pt-2">{veitAlertIcon(item.kind)}</span>
            <p className="m-0 min-w-0 flex-1 py-2 leading-snug">{item.text}</p>
            <VeitIconButton
              variant="ghost"
              size="sm"
              label={texts.close}
              icon={<X className="size-4" aria-hidden />}
              className="text-current hover:bg-muted"
              onClick={() => onDismiss(item.id)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Toasts for the whole app: `useVeitToast().show('success', text)`. Render once near the root. */
export function VeitToastProvider({ children, texts, durationMs, placement = 'responsive' }: VeitToastProviderProps) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const durations = useRef(durationMs);
  durations.current = durationMs;

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (kind: VeitToastKind, text: string, opts?: VeitToastShowOptions) => {
      const trimmed = text.trim();
      if (!trimmed) return -1;
      const id = nextId.current++;
      setItems((prev) => [...prev, { id, kind, text: trimmed }]);
      const duration = opts?.durationMs ?? durations.current?.[kind] ?? DEFAULT_DURATION[kind];
      if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const api = useMemo<VeitToastApi>(() => ({ show, dismiss }), [show, dismiss]);
  const resolvedTexts = useMemo(() => ({ ...DEFAULT_TEXTS, ...texts }), [texts]);

  return (
    <VeitToastContext.Provider value={api}>
      {children}
      {typeof document === 'undefined'
        ? null
        : createPortal(
            <VeitToastStack items={items} texts={resolvedTexts} placement={placement} onDismiss={dismiss} />,
            document.body,
          )}
    </VeitToastContext.Provider>
  );
}

/** Toast API of the nearest VeitToastProvider; throws outside of one. */
export function useVeitToast(): VeitToastApi {
  const api = useContext(VeitToastContext);
  if (!api) throw new Error('useVeitToast must be used within VeitToastProvider');
  return api;
}

/** Like useVeitToast, but null outside a provider (tests, optional embedding). */
export function useVeitToastOptional(): VeitToastApi | null {
  return useContext(VeitToastContext);
}
