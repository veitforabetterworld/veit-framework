import { useCallback, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { isEntityDeepLinkId, type EntityDeepLinkId, type EntityDeepLinkIdMode } from './useEntityDeepLinkUrlSync.js';

export { EntityDialogDismissBridge } from '@veit/react-dialog';

/** @deprecated Use {@link EntityDialogDismissBridge} from `@veit/react-dialog`. */
export { EntityDialogDismissBridge as EntityDialogDismissRef } from '@veit/react-dialog';

/**
 * Einheitliches Schließen für Deep-Link-Entity-Dialoge:
 * - `onClose` (Browser-Zurück, X, Swipe): nur UI aufräumen, URL nicht anfassen
 * - `dismissEntity` (Speichern/Löschen): `history.back()` → popstate → `onClose`
 */
export function useEntityDialogClose(opts: {
  clearUi: () => void;
  onCrossStackClose?: () => void;
  getEntityId?: () => EntityDeepLinkId | null;
  idMode?: EntityDeepLinkIdMode;
}) {
  const clearUiRef = useRef(opts.clearUi);
  clearUiRef.current = opts.clearUi;
  const onCrossStackCloseRef = useRef(opts.onCrossStackClose);
  onCrossStackCloseRef.current = opts.onCrossStackClose;
  const getEntityIdRef = useRef(opts.getEntityId);
  getEntityIdRef.current = opts.getEntityId;
  const idModeRef = useRef<EntityDeepLinkIdMode>(opts.idMode ?? 'number');
  idModeRef.current = opts.idMode ?? 'number';

  const dismissedEntityIdRef = useRef<EntityDeepLinkId | null>(null);
  const dismissRef = useRef<(() => void) | null>(null);

  const onClose = useCallback(() => {
    const id = getEntityIdRef.current?.() ?? null;
    if (isEntityDeepLinkId(id, idModeRef.current)) {
      dismissedEntityIdRef.current = id;
    }
    clearUiRef.current();
    onCrossStackCloseRef.current?.();
  }, []);

  const dismissEntity = useCallback(() => {
    dismissRef.current?.();
  }, []);

  const ackEntityOpen = useCallback((id: EntityDeepLinkId) => {
    if (isEntityDeepLinkId(id, idModeRef.current)) dismissedEntityIdRef.current = null;
  }, []);

  const resetDismissedForUrl = useCallback(() => {
    dismissedEntityIdRef.current = null;
  }, []);

  const shouldOpenFromUrl = useCallback((urlEntityId: EntityDeepLinkId) => {
    return dismissedEntityIdRef.current !== urlEntityId;
  }, []);

  return {
    onClose,
    dismissRef: dismissRef as MutableRefObject<(() => void) | null>,
    dismissEntity,
    ackEntityOpen,
    resetDismissedForUrl,
    shouldOpenFromUrl,
  };
}
