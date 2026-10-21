import { useEffect, type RefObject } from 'react';

/** `number`: Plenivo-Ids (`>= 1`). `slug`: Zeichenkette in der Query, z. B. `?pegel=`. */
export type EntityDeepLinkIdMode = 'number' | 'slug';

export type EntityDeepLinkId = number | string;

export function isEntityDeepLinkId(
  id: EntityDeepLinkId | null | undefined,
  mode: EntityDeepLinkIdMode,
): id is EntityDeepLinkId {
  if (id == null) return false;
  if (mode === 'slug') return typeof id === 'string' && id.length > 0;
  return typeof id === 'number' && Number.isFinite(id) && id >= 1;
}

export function entityIdFromParam(raw: string, mode: EntityDeepLinkIdMode): EntityDeepLinkId | null {
  if (mode === 'slug') return raw.length > 0 ? raw : null;
  const eid = Number.parseInt(raw, 10);
  return Number.isFinite(eid) && eid >= 1 ? eid : null;
}

export function entityDeepLinkKey(toolId: number, entityId: EntityDeepLinkId): string {
  return `${toolId}:${entityId}`;
}

export function isEntityDeepLinkPushInFlight(opts: {
  toolId: number;
  entityId: EntityDeepLinkId | null;
  idMode?: EntityDeepLinkIdMode;
  param: string;
  searchParams: URLSearchParams;
  openedFromUrlRef: RefObject<string | null>;
}): boolean {
  const { toolId, entityId, idMode = 'number', param, searchParams, openedFromUrlRef } = opts;
  if (!isEntityDeepLinkId(entityId, idMode) || Number.isNaN(toolId)) return false;
  const raw = searchParams.get(param);
  if (raw != null && raw !== '') return false;
  return openedFromUrlRef.current === entityDeepLinkKey(toolId, entityId);
}

export function useEntityDeepLinkUrlSync(opts: {
  ready: boolean;
  toolId: number;
  idMode?: EntityDeepLinkIdMode;
  param: string;
  entityId: EntityDeepLinkId | null;
  searchParams: URLSearchParams;
  openedFromUrlRef: RefObject<string | null>;
  isParamPushPending: () => boolean;
  resetDismissedForUrl: () => void;
  shouldOpenFromUrl: (id: EntityDeepLinkId) => boolean;
  openFromUrl: (id: EntityDeepLinkId) => void;
  clearWhenParamMissing: () => void;
  skipParamMissingClose?: boolean;
  resolveEntity?: (id: EntityDeepLinkId) => boolean;
  onInvalidUrlId?: () => void;
}) {
  const {
    ready,
    toolId,
    idMode = 'number',
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
    if (isEntityDeepLinkPushInFlight({ toolId, entityId, idMode, param, searchParams, openedFromUrlRef })) return;
    resetDismissedForUrl();
    openedFromUrlRef.current = null;
    if (skipParamMissingClose) return;
    if (isEntityDeepLinkId(entityId, idMode)) clearWhenParamMissing();
  }, [
    ready,
    toolId,
    idMode,
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
    const eid = entityIdFromParam(raw, idMode);
    if (eid == null) return;
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
    idMode,
    param,
    searchParams,
    shouldOpenFromUrl,
    openFromUrl,
    resolveEntity,
    onInvalidUrlId,
    openedFromUrlRef,
  ]);
}
