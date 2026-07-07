import { useCallback, useEffect, useRef } from 'react';
import type { NavigateOptions, URLSearchParamsInit } from 'react-router-dom';

function urlWithSearchParams(params: URLSearchParams): string {
  if (typeof window === 'undefined') return '';
  const qs = params.toString();
  return `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
}

function applySearchParamsToBrowserHistory(next: URLSearchParams, mode: 'push' | 'replace'): void {
  if (typeof window === 'undefined') return;
  const url = urlWithSearchParams(next);
  const state = window.history.state;
  if (mode === 'push') {
    window.history.pushState(state, '', url);
  } else {
    window.history.replaceState(state, '', url);
  }
}

export function useToolDeepLinkId(opts: {
  param: string;
  selectedId: number | null;
  searchParams: URLSearchParams;
  setSearchParams: (
    nextInit: URLSearchParamsInit | ((prev: URLSearchParams) => URLSearchParamsInit),
    navigateOpts?: NavigateOptions,
  ) => void;
  urlIdIsAuthoritativeForeign?: (foreignUrlId: number) => boolean;
}) {
  const { param, selectedId, searchParams, setSearchParams, urlIdIsAuthoritativeForeign } = opts;

  const pendingPushIdRef = useRef<number | null>(null);
  const pendingPushStartedAtRef = useRef<number | null>(null);

  const pushIdToUrl = useCallback(
    (id: number, navigateOpts?: { replace?: boolean }) => {
      pendingPushIdRef.current = id;
      pendingPushStartedAtRef.current = Date.now();
      const sid = String(id);
      const historyMode = navigateOpts?.replace === true ? 'replace' : 'push';

      if (typeof window !== 'undefined') {
        const prev = new URLSearchParams(window.location.search);
        if (prev.get(param) !== sid) {
          const next = new URLSearchParams(prev);
          next.set(param, sid);
          applySearchParamsToBrowserHistory(next, historyMode);
        }
      }

      setSearchParams(
        (prev) => {
          if (prev.get(param) === sid) return prev;
          const next = new URLSearchParams(prev);
          next.set(param, sid);
          return next;
        },
        { replace: true },
      );
    },
    [param, setSearchParams],
  );

  const stripParam = useCallback(() => {
    pendingPushIdRef.current = null;
    pendingPushStartedAtRef.current = null;

    if (typeof window !== 'undefined') {
      const prev = new URLSearchParams(window.location.search);
      if (prev.get(param)) {
        const next = new URLSearchParams(prev);
        next.delete(param);
        applySearchParamsToBrowserHistory(next, 'replace');
      }
    }

    setSearchParams(
      (prev) => {
        if (!prev.get(param)) return prev;
        const next = new URLSearchParams(prev);
        next.delete(param);
        return next;
      },
      { replace: true },
    );
  }, [param, setSearchParams]);

  useEffect(() => {
    const raw = searchParams.get(param);
    if (pendingPushIdRef.current != null && raw === String(pendingPushIdRef.current)) {
      pendingPushIdRef.current = null;
      pendingPushStartedAtRef.current = null;
    }
    if (selectedId == null && pendingPushIdRef.current != null) {
      const rawEmpty = raw == null || raw === '';
      if (!rawEmpty) {
        pendingPushIdRef.current = null;
        pendingPushStartedAtRef.current = null;
      }
    }

    if (selectedId == null) return;
    const sid = String(selectedId);
    if (raw === sid) return;
    if (raw == null || raw === '') return;
    if (urlIdIsAuthoritativeForeign) {
      const urlEid = parseInt(raw, 10);
      if (!Number.isNaN(urlEid) && urlEid > 0 && urlEid !== selectedId && urlIdIsAuthoritativeForeign(urlEid)) {
        return;
      }
    }
    const next = new URLSearchParams(searchParams);
    next.set(param, sid);
    applySearchParamsToBrowserHistory(next, 'replace');
    setSearchParams(next, { replace: true });
  }, [selectedId, param, searchParams, setSearchParams, urlIdIsAuthoritativeForeign]);

  const isMissingParamDuringPush = useCallback((): boolean => {
    if (pendingPushIdRef.current == null) return false;
    const raw = searchParams.get(param);
    return raw == null || raw === '';
  }, [param, searchParams]);

  return { pushIdToUrl, stripParam, isMissingParamDuringPush };
}
