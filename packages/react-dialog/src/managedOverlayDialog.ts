import { useCallback, useMemo, useRef, useState } from 'react';

/** Laufzeit-Marker — kein `declare const` (würde nach TS-Compile fehlen). */
const MANAGED_OVERLAY_DIALOG_BINDING_BRAND = Symbol.for(
  '@veit/react-dialog/ManagedOverlayDialogBinding',
);

/**
 * Gebrandete Open/Close-Kopplung für Overlay-Presets.
 * Nur via {@link useManagedOverlayDialog} oder {@link useManagedOverlayDialogBinding} erzeugbar —
 * verhindert `open`-Literal + Conditional-Mount ohne State-Hook.
 */
export type ManagedOverlayDialogBinding = Readonly<{
  readonly open: boolean;
  readonly onClose: () => void;
}>;

function createManagedOverlayDialogBinding(
  open: boolean,
  onClose: () => void,
): ManagedOverlayDialogBinding {
  return {
    [MANAGED_OVERLAY_DIALOG_BINDING_BRAND]: true,
    open,
    onClose,
  } as ManagedOverlayDialogBinding;
}

export type ManagedOverlayDialog = Readonly<{
  readonly binding: ManagedOverlayDialogBinding;
  readonly show: () => void;
  readonly hide: () => void;
  readonly setOpen: (open: boolean) => void;
}>;

/** Eigener Open-State für einen Overlay-Dialog (Kachel → `show()`). Shell immer gemountet lassen. */
export function useManagedOverlayDialog(initialOpen = false): ManagedOverlayDialog {
  const [open, setOpen] = useState(initialOpen);
  const hide = useCallback(() => setOpen(false), []);
  const show = useCallback(() => setOpen(true), []);
  return useMemo(() => {
    const binding = createManagedOverlayDialogBinding(open, hide);
    return { binding, show, hide, setOpen };
  }, [open, hide, show]);
}

/**
 * Für abgeleiteten Open-State (z. B. `selectedId != null`).
 * Parent-State bleibt; Binding nur für Overlay-Presets.
 */
export function useManagedOverlayDialogBinding(
  open: boolean,
  onClose: () => void,
): ManagedOverlayDialogBinding {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const stableOnClose = useCallback(() => {
    onCloseRef.current();
  }, []);
  return useMemo(
    () => createManagedOverlayDialogBinding(open, stableOnClose),
    [open, stableOnClose],
  );
}

/** Intern: Binding → VeitDialog-Props. */
export function overlayBindingToDialogProps(binding: ManagedOverlayDialogBinding): {
  open: boolean;
  onClose: () => void;
} {
  return { open: binding.open, onClose: binding.onClose };
}
