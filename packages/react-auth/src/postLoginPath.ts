export function safeNextParam(raw: string | null): string | null {
  if (raw == null || raw === '') return null;
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.startsWith('/') && !decoded.startsWith('//') && !decoded.includes('://')) {
      return decoded;
    }
  } catch {
    void 0;
  }
  return null;
}

/** `state.from` wie von `Navigate` / `ProtectedRoute` übergeben. */
export function postLoginPathFromRouterState(stored: unknown): string | null {
  if (!stored || typeof stored !== 'object') return null;
  const o = stored as { pathname?: unknown; search?: unknown; hash?: unknown };
  if (typeof o.pathname !== 'string' || !o.pathname.startsWith('/')) return null;
  const search = typeof o.search === 'string' ? o.search : '';
  const hash = typeof o.hash === 'string' ? o.hash : '';
  return `${o.pathname}${search}${hash}`;
}

export function resolvePostLoginPath(stateFrom: unknown, nextQuery: string | null, fallback: string): string {
  return postLoginPathFromRouterState(stateFrom) ?? safeNextParam(nextQuery) ?? fallback;
}
