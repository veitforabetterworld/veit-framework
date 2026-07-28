import { createContext, useContext, type ReactNode } from 'react';

type VeitInlineActionLayoutValue = {
  /** Zu wenig Platz – z. B. nur Icon für „Zurück“. */
  compact: boolean;
  /** Inline-Aktionen mit Textlabel (sonst nur Icon). Im Hamburger-Menü immer mit Label. */
  showInlineLabels: boolean;
};

const VeitInlineActionLayoutContext = createContext<VeitInlineActionLayoutValue>({
  compact: false,
  showInlineLabels: true,
});

export function VeitInlineActionLayoutProvider({
  compact,
  showInlineLabels = !compact,
  children,
}: {
  compact: boolean;
  showInlineLabels?: boolean;
  children: ReactNode;
}) {
  return (
    <VeitInlineActionLayoutContext.Provider value={{ compact, showInlineLabels }}>
      {children}
    </VeitInlineActionLayoutContext.Provider>
  );
}

export function useVeitInlineActionLayout() {
  return useContext(VeitInlineActionLayoutContext);
}
