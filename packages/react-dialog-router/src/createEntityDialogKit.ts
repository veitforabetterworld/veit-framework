import { useRef } from 'react';
import type { NavigateOptions, URLSearchParamsInit } from 'react-router-dom';
import { useEntityDeepLinkUrlSync } from './useEntityDeepLinkUrlSync.js';
import { useEntityDialogClose } from './useEntityDialogClose.js';
import { useToolDeepLinkId } from './useToolDeepLinkId.js';

export type EntityDialogKitOptions = {
  param: string;
  toolId: number;
  selectedId: number | null;
  searchParams: URLSearchParams;
  setSearchParams: (
    nextInit: URLSearchParamsInit | ((prev: URLSearchParams) => URLSearchParamsInit),
    navigateOpts?: NavigateOptions,
  ) => void;
  clearUi: () => void;
  openFromUrl: (id: number) => void;
  onCrossStackClose?: () => void;
  getEntityId?: () => number | null;
  ready?: boolean;
  skipParamMissingClose?: boolean;
  resolveEntity?: (id: number) => boolean;
  onInvalidUrlId?: () => void;
  urlIdIsAuthoritativeForeign?: (foreignUrlId: number) => boolean;
};

/** Hook: bündelt Deep-Link-Hooks für Entity-Dialoge. */
export function useEntityDialogKit(opts: EntityDialogKitOptions) {
  const openedFromUrlRef = useRef<string | null>(null);

  const close = useEntityDialogClose({
    clearUi: opts.clearUi,
    onCrossStackClose: opts.onCrossStackClose,
    getEntityId: opts.getEntityId ?? (() => opts.selectedId),
  });

  const url = useToolDeepLinkId({
    param: opts.param,
    selectedId: opts.selectedId,
    searchParams: opts.searchParams,
    setSearchParams: opts.setSearchParams,
    urlIdIsAuthoritativeForeign: opts.urlIdIsAuthoritativeForeign,
  });

  useEntityDeepLinkUrlSync({
    ready: opts.ready ?? true,
    toolId: opts.toolId,
    param: opts.param,
    entityId: opts.selectedId,
    searchParams: opts.searchParams,
    openedFromUrlRef,
    isParamPushPending: url.isMissingParamDuringPush,
    resetDismissedForUrl: close.resetDismissedForUrl,
    shouldOpenFromUrl: close.shouldOpenFromUrl,
    openFromUrl: opts.openFromUrl,
    clearWhenParamMissing: opts.clearUi,
    skipParamMissingClose: opts.skipParamMissingClose,
    resolveEntity: opts.resolveEntity,
    onInvalidUrlId: opts.onInvalidUrlId,
  });

  return {
    ...close,
    ...url,
    openedFromUrlRef,
  };
}

/** @deprecated Use {@link useEntityDialogKit} */
export const createEntityDialogKit = useEntityDialogKit;
