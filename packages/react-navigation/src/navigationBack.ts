const EXTERNAL_ENTRY_SESSION_KEY = 'plenivo:external_entry_back';

/** React Router (BrowserRouter) legt den History-Index in `history.state.idx` ab. */
export function historyStateIndex(): number | null {
  if (typeof window === 'undefined') return null;
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === 'number' && Number.isFinite(idx) ? idx : null;
}

/** True, wenn in dieser Tab-Session eine vorherige In-App-Seite existiert. */
export function hasInAppHistoryBack(): boolean {
  const idx = historyStateIndex();
  return idx !== null && idx > 0;
}

export function markExternalEntrySession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(EXTERNAL_ENTRY_SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearExternalEntrySession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(EXTERNAL_ENTRY_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function isExternalEntrySession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(EXTERNAL_ENTRY_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Fallback statt History-Back: externer Einstieg oder noch keine echte In-App-Navigation.
 */
export function shouldNavigateBackViaFallback(): boolean {
  return isExternalEntrySession() || !hasInAppHistoryBack();
}

/**
 * Pfad der letzten same-origin-Seite (Voll-Reload von einer anderen App-URL),
 * sonst null — z. B. nach OAuth/Mollie-Redirect von extern.
 */
export function sameOriginReferrerAppPath(): string | null {
  if (typeof window === 'undefined' || !document.referrer) return null;
  try {
    const ref = new URL(document.referrer);
    if (ref.origin !== window.location.origin) return null;
    const path = `${ref.pathname}${ref.search}${ref.hash}`;
    if (path === '' || path === window.location.pathname + window.location.search + window.location.hash) {
      return null;
    }
    return path;
  } catch {
    return null;
  }
}
