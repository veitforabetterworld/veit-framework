import { Menu, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import { VeitInlineActionLayoutProvider } from './VeitInlineActionLayoutContext.js';
import { VeitInlineActionMenuProvider } from './VeitInlineActionMenuContext.js';
import {
  measureEndContentWidth,
  resolveNeedsMenuBySpace,
  resolveShowInlineLabels,
  siblingOccupiedWidth,
} from './veitInlineActionBarMeasure.js';

const endMeasureHostClass =
  'pointer-events-none fixed top-0 -left-[10000px] -z-50 opacity-0';

const endMeasureClass = 'flex w-max flex-nowrap items-center justify-start gap-1.5 sm:gap-3';

const endInnerScrollClass =
  'flex w-max min-h-0 min-w-0 max-w-full shrink flex-nowrap items-center justify-start gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain sm:gap-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';

const menuPanelClass =
  'absolute right-0 top-full z-[60] mt-1.5 max-h-[min(70vh,28rem)] w-[min(calc(100vw-1.5rem),20rem)] overflow-y-auto rounded-xl border border-outline-variant/40 bg-surface/95 py-2 shadow-level-3 backdrop-blur-xl dark:border-white/10';

const menuNavClass =
  'flex flex-col gap-1 px-2 [&>div]:contents [&>nav]:contents [&_[class*="flex-nowrap"]]:!flex-col [&_[class*="flex-nowrap"]]:!items-stretch [&_[class*="flex-nowrap"]]:!gap-1';

const defaultMenuIconClass = 'h-[1.125rem] w-[1.125rem] shrink-0 sm:h-5 sm:w-5';

export type VeitResponsiveInlineActionBarProps = {
  children: ReactNode;
  className?: string;
  /** aria-label / title when the menu is closed */
  menuOpenLabel: string;
  /** aria-label / title when the menu is open */
  menuCloseLabel: string;
  /** aria-label for the overflow nav panel */
  navAriaLabel: string;
  menuIconClassName?: string;
} & Omit<ComponentPropsWithoutRef<'div'>, 'className' | 'children'>;

/**
 * Responsive action bar: labels → icon-only → hamburger depending on available space.
 * Labels are injected via props (no i18n dependency). Layout/menu context is provided for children.
 */
export function VeitResponsiveInlineActionBar({
  children,
  className = '',
  menuOpenLabel,
  menuCloseLabel,
  navAriaLabel,
  menuIconClassName = defaultMenuIconClass,
  ...rest
}: VeitResponsiveInlineActionBarProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const labeledMeasureRef = useRef<HTMLDivElement | null>(null);
  const iconOnlyMeasureRef = useRef<HTMLDivElement | null>(null);
  const menuMeasureRef = useRef<HTMLDivElement | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);
  const iconOnlyEnterWidthRef = useRef<number | null>(null);
  const [showInlineLabels, setShowInlineLabels] = useState(true);
  const [needsMenu, setNeedsMenu] = useState(false);
  const [hasItems, setHasItems] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const compact = !showInlineLabels;
  const showMobileMenu = needsMenu && hasItems;

  useEffect(() => {
    if (!showMobileMenu) setMenuOpen(false);
  }, [showMobileMenu]);

  useLayoutEffect(() => {
    if (menuOpen) return;
    const menuEl = menuMeasureRef.current;
    const measureItems = () => {
      const next = menuEl?.querySelector('a, button, [role="menuitem"]') != null;
      setHasItems((prev) => (prev === next ? prev : next));
    };
    measureItems();
    if (menuEl == null) return;
    const ro = new ResizeObserver(measureItems);
    ro.observe(menuEl);
    return () => ro.disconnect();
  }, [children, menuOpen]);

  useLayoutEffect(() => {
    if (menuOpen) return;
    const selfEl = rootRef.current;
    const rowEl = selfEl?.parentElement;
    if (selfEl == null || rowEl == null || typeof ResizeObserver === 'undefined') return;

    const measure = () => {
      const labeledMeasureEl = labeledMeasureRef.current;
      const iconOnlyMeasureEl = iconOnlyMeasureRef.current;
      if (labeledMeasureEl == null || iconOnlyMeasureEl == null) return;

      const availableForEnd = rowEl.clientWidth - siblingOccupiedWidth(rowEl, selfEl);
      const labeledWidth = measureEndContentWidth(labeledMeasureEl);
      const iconOnlyWidth = measureEndContentWidth(iconOnlyMeasureEl);

      const labeledTooWide = labeledWidth > availableForEnd + 1;
      const iconOnlyTooWide = iconOnlyWidth > availableForEnd + 1;

      setShowInlineLabels((prev) => {
        const next = resolveShowInlineLabels({
          prev,
          rowWidth: rowEl.clientWidth,
          labeledTooWide,
          iconOnlyTooWide,
          iconOnlyEnterWidthRef,
        });
        return prev === next ? prev : next;
      });
      setNeedsMenu((prev) => {
        const next = resolveNeedsMenuBySpace({ prev, iconOnlyTooWide });
        return prev === next ? prev : next;
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(rowEl);
    const labeledObs = labeledMeasureRef.current;
    if (labeledObs != null) ro.observe(labeledObs);
    const iconOnlyObs = iconOnlyMeasureRef.current;
    if (iconOnlyObs != null) ro.observe(iconOnlyObs);
    return () => ro.disconnect();
  }, [children, menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuPanelRef.current?.contains(target)) return;
      closeMenu();
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen, closeMenu]);

  return (
    <VeitInlineActionLayoutProvider compact={compact} showInlineLabels={showInlineLabels}>
      <div ref={rootRef} className={`relative ${className}`.trim()} {...rest}>
        {!menuOpen ? (
          <>
            <div className="sr-only" aria-hidden>
              <div ref={menuMeasureRef}>
                <VeitInlineActionMenuProvider surface="menu" closeMenu={closeMenu}>
                  <div className={menuNavClass}>{children}</div>
                </VeitInlineActionMenuProvider>
              </div>
            </div>
            <div className={endMeasureHostClass} aria-hidden>
              <VeitInlineActionLayoutProvider compact={false} showInlineLabels>
                <VeitInlineActionMenuProvider surface="inline" closeMenu={closeMenu}>
                  <div ref={labeledMeasureRef} className={endMeasureClass}>
                    {children}
                  </div>
                </VeitInlineActionMenuProvider>
              </VeitInlineActionLayoutProvider>
              <VeitInlineActionLayoutProvider compact showInlineLabels={false}>
                <VeitInlineActionMenuProvider surface="inline" closeMenu={closeMenu}>
                  <div ref={iconOnlyMeasureRef} className={endMeasureClass}>
                    {children}
                  </div>
                </VeitInlineActionMenuProvider>
              </VeitInlineActionLayoutProvider>
            </div>
          </>
        ) : null}
        {showMobileMenu ? (
          <div ref={menuPanelRef} className="relative shrink-0">
            <button
              type="button"
              className="btn-secondary btn-sm !px-0 w-9 sm:w-10"
              aria-label={menuOpen ? menuCloseLabel : menuOpenLabel}
              title={menuOpen ? menuCloseLabel : menuOpenLabel}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <X className={menuIconClassName} aria-hidden />
              ) : (
                <Menu className={menuIconClassName} aria-hidden />
              )}
            </button>
            {menuOpen ? (
              <VeitInlineActionMenuProvider surface="menu" closeMenu={closeMenu}>
                <nav aria-label={navAriaLabel} className={`${menuPanelClass} ${menuNavClass}`} role="menu">
                  {children}
                </nav>
              </VeitInlineActionMenuProvider>
            ) : null}
          </div>
        ) : (
          <VeitInlineActionMenuProvider surface="inline" closeMenu={closeMenu}>
            <div className={endInnerScrollClass}>{children}</div>
          </VeitInlineActionMenuProvider>
        )}
      </div>
    </VeitInlineActionLayoutProvider>
  );
}
