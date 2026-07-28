import { createContext, useContext, type ReactNode } from 'react';

export type VeitInlineActionSurface = 'inline' | 'menu';

type VeitInlineActionMenuContextValue = {
  surface: VeitInlineActionSurface;
  closeMenu: () => void;
};

const VeitInlineActionMenuContext = createContext<VeitInlineActionMenuContextValue | null>(null);

export function VeitInlineActionMenuProvider({
  surface,
  closeMenu,
  children,
}: {
  surface: VeitInlineActionSurface;
  closeMenu: () => void;
  children: ReactNode;
}) {
  return (
    <VeitInlineActionMenuContext.Provider value={{ surface, closeMenu }}>
      {children}
    </VeitInlineActionMenuContext.Provider>
  );
}

export function useVeitInlineActionMenu() {
  return useContext(VeitInlineActionMenuContext);
}

/** Nur im Hamburger-Menü sichtbar. */
export function VeitInlineActionMenuOnly({ children }: { children: ReactNode }) {
  const ctx = useVeitInlineActionMenu();
  if (ctx == null || ctx.surface !== 'menu') return null;
  return children;
}

/** Nur in der horizontalen Leiste sichtbar, nicht im Hamburger-Menü. */
export function VeitInlineActionInlineOnly({ children }: { children: ReactNode }) {
  const ctx = useVeitInlineActionMenu();
  if (ctx?.surface === 'menu') return null;
  return children;
}
