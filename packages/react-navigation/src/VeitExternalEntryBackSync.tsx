import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

import {
  clearExternalEntrySession,
  hasInAppHistoryBack,
  markExternalEntrySession,
} from './navigationBack.js';

/**
 * Einmal pro App-Shell mounten: merkt externen Tab-Einstieg und erlaubt History-Back
 * erst nach echter In-App-Navigation (PUSH).
 */
export function VeitExternalEntryBackSync() {
  const location = useLocation();
  const navType = useNavigationType();
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (!bootstrapped.current) {
      bootstrapped.current = true;
      if (!hasInAppHistoryBack()) {
        markExternalEntrySession();
      }
      return;
    }
    if (navType === 'PUSH') {
      clearExternalEntrySession();
    }
  }, [location.key, navType]);

  return null;
}
