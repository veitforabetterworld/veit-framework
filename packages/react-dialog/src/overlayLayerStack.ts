import { useLayoutEffect, useRef, useState } from 'react';

/** Abstand zwischen übereinanderliegenden Overlay-Ebenen (Backdrop vs. Panel: +5 in {@link VeitDialog}). */
export const VEIT_DIALOG_Z_STACK_STEP = 50;

const VEIT_OVERLAY_LAYER_FLOOR = 200;

let stackCounter = 0;
const activeLayers = new Map<object, number>();

export function acquireOverlayLayer(token: object): number {
  stackCounter += 1;
  const base = VEIT_OVERLAY_LAYER_FLOOR + stackCounter * VEIT_DIALOG_Z_STACK_STEP;
  activeLayers.set(token, base);
  return base;
}

export function releaseOverlayLayer(token: object): void {
  if (!activeLayers.delete(token)) return;
  if (activeLayers.size === 0) stackCounter = 0;
}

/**
 * Registriert eine Overlay-Schicht im globalen Stack, solange `active === true`.
 * Später geöffnete Schichten liegen automatisch über früheren.
 */
export function useVeitOverlayLayer(active: boolean): number {
  const tokenRef = useRef<object>({});
  const [base, setBase] = useState(VEIT_OVERLAY_LAYER_FLOOR);

  useLayoutEffect(() => {
    if (!active) return;
    const acquired = acquireOverlayLayer(tokenRef.current);
    setBase(acquired);
    return () => releaseOverlayLayer(tokenRef.current);
  }, [active]);

  return base;
}

/** Alias für {@link useVeitOverlayLayer}. */
export const useVeitOverlayLayerZIndex = useVeitOverlayLayer;
