import { useEffect, type MutableRefObject } from 'react';

export function entityDeepLinkKey(toolId: number, entityId: number): string {
  return `${toolId}:${entityId}`;
}

export function isEntityDeepLinkPushInFlight(opts: {
  toolId: number;
  entityId: number | null;
  param: string;
  searchParams: URLSearchParams;
  openedFromUrlRef: MutableRefObject<string | null>;
}): boolean {
  const { toolId, entityId, param, searchParams, openedFromUrlRef } = opts;
  if (entityId == null || entityId < 1 || Number.isNaN(toolId)) return false;
  const raw = searchParams.get(param);
  if (raw != null && raw !== '') return false;
  return openedFromUrlRef.current === entityDeepLinkKey(toolId, entityId);
}

export function useEntityDeepLinkUrlSync(opts: {
  ready: boolean;
  toolId: number;
  param: string;
  entityId: number | null;
  searchParams: URLSearchParams;
  openedFromUrlRef: MutableRefObject<string | null>;
  isParamPushPending: () => boolean;
  resetDismissedForUrl: () => void;
  shouldOpenFromUrl: (id: number) => boolean;
  openFromUrl: (id: number) => void;
  clearWhenParamMissing: () => void;
  skipParamMissingClose?: boolean;
  resolveEntity?: (id: number) => boolean;
  onInvalidUrlId?: () => void;
}) {
  const {
    ready,
    toolId,
    param,
    entityId,
    searchParams,
    openedFromUrlRef,
    isParamPushPending,
    resetDismissedForUrl,
    shouldOpenFromUrl,
    openFromUrl,
    clearWhenParamMissing,
    skipParamMissingClose,
    resolveEntity,
    onInvalidUrlId,
  } = opts;

  useEffect(() => {
    if (!ready) return;
    const raw = searchParams.get(param);
    if (raw != null && raw !== '') return;
    if (isParamPushPending()) return;
    if (isEntityDeepLinkPushInFlight({ toolId, entityId, param, searchParams, openedFromUrlRef })) return;
    resetDismissedForUrl();
    openedFromUrlRef.current = null;
    if (skipParamMissingClose) return;
    if (entityId != null) clearWhenParamMissing();
  }, [
    ready,
    toolId,
    param,
    entityId,
    searchParams,
    isParamPushPending,
    resetDismissedForUrl,
    clearWhenParamMissing,
    skipParamMissingClose,
    openedFromUrlRef,
  ]);

  useEffect(() => {
    if (!ready) return;
    const raw = searchParams.get(param);
    if (raw == null || raw === '') return;
    const eid = parseInt(raw, 10);
    if (Number.isNaN(eid) || eid < 1) return;
    const key = entityDeepLinkKey(toolId, eid);
    if (openedFromUrlRef.current === key) return;
    if (!shouldOpenFromUrl(eid)) return;
    if (resolveEntity && !resolveEntity(eid)) {
      onInvalidUrlId?.();
      return;
    }
    openedFromUrlRef.current = key;
    openFromUrl(eid);
  }, [
    ready,
    toolId,
    param,
    searchParams,
    shouldOpenFromUrl,
    openFromUrl,
    resolveEntity,
    onInvalidUrlId,
    openedFromUrlRef,
  ]);
}
