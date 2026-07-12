import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { sameOriginReferrerAppPath, shouldNavigateBackViaFallback } from './navigationBack.js';

export type VeitBackNavigationScopeValue = {
  fallbackTo: string;
  backAriaLabel: string;
  compact: boolean;
  hidden: boolean;
  goBack: () => void;
};

const VeitBackNavigationScopeContext = createContext<VeitBackNavigationScopeValue | null>(null);

export function useVeitBackNavigationScope(): VeitBackNavigationScopeValue {
  const ctx = useContext(VeitBackNavigationScopeContext);
  if (!ctx) {
    throw new Error('VeitBackButton must be used within VeitBackNavigationScope');
  }
  return ctx;
}

export type VeitBackNavigationScopeProps = {
  fallbackTo: string;
  backAriaLabel: string;
  compact?: boolean;
  hidden?: boolean;
  children: ReactNode;
};

export function VeitBackNavigationScope({
  fallbackTo,
  backAriaLabel,
  compact = false,
  hidden = false,
  children,
}: VeitBackNavigationScopeProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathWhenBackClicked = useRef<string | null>(null);

  const goBack = () => {
    if (shouldNavigateBackViaFallback()) {
      navigate(sameOriginReferrerAppPath() ?? fallbackTo, { replace: true });
      return;
    }
    if (fallbackTo && fallbackTo !== '/') {
      pathWhenBackClicked.current = location.pathname;
      navigate(-1);
      return;
    }
    navigate(-1);
  };

  useEffect(() => {
    if (pathWhenBackClicked.current === null) return;
    const timer = setTimeout(() => {
      if (location.pathname === pathWhenBackClicked.current && fallbackTo) {
        pathWhenBackClicked.current = null;
        navigate(fallbackTo, { replace: true });
      } else {
        pathWhenBackClicked.current = null;
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [fallbackTo, location.pathname, navigate]);

  if (hidden) return null;

  return (
    <VeitBackNavigationScopeContext.Provider
      value={{ fallbackTo, backAriaLabel, compact, hidden, goBack }}
    >
      {children}
    </VeitBackNavigationScopeContext.Provider>
  );
}
