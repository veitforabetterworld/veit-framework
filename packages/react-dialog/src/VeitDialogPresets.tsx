import type { MutableRefObject, ReactNode } from 'react';
import {
  VeitDialog,
  VeitDialogFooter,
  useVeitDialogDismiss,
  type VeitDialogProps,
} from './VeitDialog.js';
import {
  VeitDialogEditActionsFooter,
  type VeitDialogEditActionsFooterDismissOnlyProps,
  type VeitDialogEditActionsFooterEditProps,
  type VeitDialogEditActionsFooterProps,
} from './VeitDialogEditActionsFooter.js';
import { useLayoutEffect } from 'react';
import { veitDialogHistoryFlags, type VeitDialogHistoryMode } from './dialogHistoryMode.js';
import {
  useResolvedVeitDialogUnsavedConfirm,
  type VeitDialogUnsavedConfirmOverride,
} from './unsavedConfirmContext.js';

export function EntityDialogDismissBridge({
  dismissRef,
}: {
  dismissRef: MutableRefObject<(() => void) | null>;
}) {
  const dismiss = useVeitDialogDismiss();
  useLayoutEffect(() => {
    dismissRef.current = dismiss;
    return () => {
      dismissRef.current = null;
    };
  }, [dismiss, dismissRef]);
  return null;
}

type VeitDialogPresetBase = Omit<
  VeitDialogProps,
  'historyCoalesce' | 'historyNested' | 'historyMode' | 'presentation' | 'footer'
>;

function presetDialogProps(
  mode: VeitDialogHistoryMode,
  props: VeitDialogPresetBase & { bottomDockRoot?: HTMLElement | null },
): VeitDialogProps {
  const flags = veitDialogHistoryFlags(mode);
  return {
    ...props,
    historyMode: mode,
    presentation: flags.presentation,
    bottomDockRoot: props.bottomDockRoot,
  };
}

export type VeitOverlayDialogProps = VeitDialogPresetBase & {
  unsavedChangesConfirm?: VeitDialogUnsavedConfirmOverride;
};

/** Verschachtelter Dialog ohne eigene URL — ein Browser-Zurück schließt nur diesen Dialog. */
export function VeitOverlayDialog({ unsavedChangesConfirm: unsavedOverride, ...props }: VeitOverlayDialogProps) {
  const unsavedChangesConfirm = useResolvedVeitDialogUnsavedConfirm(unsavedOverride, 'edit');
  return <VeitDialog {...presetDialogProps('overlay', props)} unsavedChangesConfirm={unsavedChangesConfirm} />;
}

export type VeitEntityDialogProps = VeitDialogPresetBase & {
  /** Ref für programmatisches Schließen nach Speichern/Löschen (via `@veit/react-dialog-router`). */
  dismissRef?: MutableRefObject<(() => void) | null>;
  /** Standard: `entity` (Deep-Link). Für Create-Flows ohne URL z. B. `overlay`. */
  historyMode?: 'entity' | 'overlay';
  unsavedChangesConfirm?: VeitDialogUnsavedConfirmOverride;
};

/** Deep-Link-Entity-Dialog — History-Marker auf dem URL-Eintrag (Coalesce). */
export function VeitEntityDialog({
  dismissRef,
  children,
  historyMode = 'entity',
  unsavedChangesConfirm: unsavedOverride,
  ...props
}: VeitEntityDialogProps) {
  const unsavedChangesConfirm = useResolvedVeitDialogUnsavedConfirm(unsavedOverride, 'edit');
  return (
    <VeitDialog {...presetDialogProps(historyMode, { ...props, children })} unsavedChangesConfirm={unsavedChangesConfirm}>
      {dismissRef != null ? <EntityDialogDismissBridge dismissRef={dismissRef} /> : null}
      {children}
    </VeitDialog>
  );
}

export type VeitSheetDialogProps = VeitDialogPresetBase & {
  bottomDockRoot?: HTMLElement | null;
  dismissRef?: MutableRefObject<(() => void) | null>;
  unsavedChangesConfirm?: VeitDialogUnsavedConfirmOverride;
};

/** Bottom-Sheet ohne Backdrop (z. B. Kartentool). */
export function VeitSheetDialog({
  dismissRef,
  children,
  unsavedChangesConfirm: unsavedOverride,
  ...props
}: VeitSheetDialogProps) {
  const unsavedChangesConfirm = useResolvedVeitDialogUnsavedConfirm(unsavedOverride, 'edit');
  return (
    <VeitDialog {...presetDialogProps('sheet', { ...props, children })} unsavedChangesConfirm={unsavedChangesConfirm}>
      {dismissRef != null ? <EntityDialogDismissBridge dismissRef={dismissRef} /> : null}
      {children}
    </VeitDialog>
  );
}

export type VeitPickerDialogProps = VeitDialogPresetBase & {
  /** Standard: centered, md */
  variant?: 'responsive' | 'centered';
  size?: 'sm' | 'md' | 'lg';
  /** Optional: Standard-Fußzeile (z. B. Bestätigen oder Schließen). */
  footerProps?: VeitActionDialogFooterProps;
  unsavedChangesConfirm?: VeitDialogUnsavedConfirmOverride;
};

/** Auswahl-/Picker-Dialog über einem Entity (Overlay-History). */
export function VeitPickerDialog({
  variant = 'centered',
  size = 'lg',
  footerProps,
  unsavedChangesConfirm: unsavedOverride,
  ...props
}: VeitPickerDialogProps) {
  const unsavedChangesConfirm = useResolvedVeitDialogUnsavedConfirm(unsavedOverride, 'edit');
  return (
    <VeitDialog
      {...presetDialogProps('overlay', { variant, size, ...props })}
      unsavedChangesConfirm={unsavedChangesConfirm}
      footer={
        footerProps != null
          ? ({ dismiss }) => (
              <VeitDialogEditActionsFooter
                {...(footerProps as VeitDialogEditActionsFooterProps)}
                dismiss={dismiss}
              />
            )
          : undefined
      }
    />
  );
}

/** Fußzeilen-Props für Edit-Dialoge — `dismiss` wird intern injiziert; `dirty` ist Pflicht (außer dismissOnly). `formBaseline` via {@link useDialogFormBaseline}. */
export type VeitEditDialogFooterProps =
  | Omit<VeitDialogEditActionsFooterDismissOnlyProps, 'dismiss'>
  | (Omit<VeitDialogEditActionsFooterEditProps, 'dismiss'> & { dirty: boolean });

/** Fußzeilen-Props für Action-Dialoge (One-Shot) — `dirty` optional. */
export type VeitActionDialogFooterProps =
  | Omit<VeitDialogEditActionsFooterDismissOnlyProps, 'dismiss'>
  | Omit<VeitDialogEditActionsFooterEditProps, 'dismiss'>;

type VeitEditActionDialogBase = VeitDialogPresetBase & {
  historyMode?: 'entity' | 'overlay' | 'sheet';
  /** Ref für programmatisches Schließen nach Speichern/Löschen. */
  dismissRef?: MutableRefObject<(() => void) | null>;
  bottomDockRoot?: HTMLElement | null;
  unsavedChangesConfirm?: VeitDialogUnsavedConfirmOverride;
};

export type VeitEditDialogProps = VeitEditActionDialogBase & {
  footerProps: VeitEditDialogFooterProps;
};

/** Entity-, Overlay- oder Sheet-Dialog mit Standard-Fußzeile (Speichern/Abbrechen/Löschen). */
export function VeitEditDialog({
  historyMode = 'overlay',
  dismissRef,
  bottomDockRoot,
  footerProps,
  unsavedChangesConfirm: unsavedOverride,
  children,
  ...props
}: VeitEditDialogProps) {
  const unsavedChangesConfirm = useResolvedVeitDialogUnsavedConfirm(unsavedOverride, 'edit');
  return (
    <VeitDialog
      {...presetDialogProps(historyMode, { ...props, children, bottomDockRoot })}
      unsavedChangesConfirm={unsavedChangesConfirm}
      footer={({ dismiss }) => (
        <VeitDialogEditActionsFooter
          {...(footerProps as VeitDialogEditActionsFooterProps)}
          dismiss={dismiss}
        />
      )}
    >
      {dismissRef != null ? <EntityDialogDismissBridge dismissRef={dismissRef} /> : null}
      {children}
    </VeitDialog>
  );
}

export type VeitActionDialogProps = VeitEditActionDialogBase & {
  footerProps: VeitActionDialogFooterProps;
};

/** One-Shot-Dialog (Import, Senden, Generieren) — kein Pflicht-`dirty`, standardmäßig ohne unsavedConfirm. */
export function VeitActionDialog({
  historyMode = 'overlay',
  dismissRef,
  bottomDockRoot,
  footerProps,
  unsavedChangesConfirm: unsavedOverride,
  children,
  ...props
}: VeitActionDialogProps) {
  const unsavedChangesConfirm = useResolvedVeitDialogUnsavedConfirm(unsavedOverride, 'action');
  return (
    <VeitDialog
      {...presetDialogProps(historyMode, { ...props, children, bottomDockRoot })}
      unsavedChangesConfirm={unsavedChangesConfirm}
      footer={({ dismiss }) => (
        <VeitDialogEditActionsFooter
          {...(footerProps as VeitDialogEditActionsFooterProps)}
          dismiss={dismiss}
        />
      )}
    >
      {dismissRef != null ? <EntityDialogDismissBridge dismissRef={dismissRef} /> : null}
      {children}
    </VeitDialog>
  );
}

export type VeitWizardDialogProps = VeitDialogPresetBase & {
  /** Optionaler Zurück-Schritt (links neben Schließen). */
  onBack?: () => void;
  backLabel?: string;
  closeLabel: string;
  busy?: boolean;
  /** Zusätzliche Footer-Aktionen rechts (z. B. Bestätigen). */
  trailing?: ReactNode;
  unsavedChangesConfirm?: VeitDialogUnsavedConfirmOverride;
};

/** Mehrstufiger Overlay-Wizard (z. B. Verknüpfung hinzufügen). */
export function VeitWizardDialog({
  onBack,
  backLabel,
  closeLabel,
  busy = false,
  trailing,
  disabled,
  blockBackdropClose,
  unsavedChangesConfirm: unsavedOverride,
  ...props
}: VeitWizardDialogProps) {
  const unsavedChangesConfirm = useResolvedVeitDialogUnsavedConfirm(unsavedOverride, 'edit');
  const isBusy = busy || !!disabled;
  return (
    <VeitDialog
      {...presetDialogProps('overlay', {
        ...props,
        disabled: isBusy,
        blockBackdropClose: blockBackdropClose ?? isBusy,
      })}
      unsavedChangesConfirm={unsavedChangesConfirm}
      footer={({ dismiss }) => (
        <VeitDialogFooter className="flex flex-wrap gap-2">
          {onBack != null && backLabel != null ? (
            <button type="button" className="btn-secondary min-h-[44px]" disabled={isBusy} onClick={onBack}>
              {backLabel}
            </button>
          ) : null}
          <button type="button" className="btn-secondary min-h-[44px]" disabled={isBusy} onClick={() => dismiss()}>
            {closeLabel}
          </button>
          {trailing}
        </VeitDialogFooter>
      )}
    />
  );
}

export { veitDialogHistoryFlags } from './dialogHistoryMode.js';
export type { VeitDialogHistoryMode } from './dialogHistoryMode.js';
export { resolveVeitDialogHistoryMode } from './dialogHistoryMode.js';

export type VeitEntityEditDialogProps = Omit<VeitEditDialogProps, 'historyMode' | 'dismissRef'> & {
  /** Pflicht bei Deep-Link-Bearbeitung — typisch via `useEntityDialogClose` (`@veit/react-dialog-router`). */
  dismissRef: NonNullable<VeitEditDialogProps['dismissRef']>;
};
export function VeitEntityEditDialog(props: VeitEntityEditDialogProps) {
  return <VeitEditDialog {...props} historyMode="entity" />;
}

export type VeitOverlayEditDialogProps = Omit<VeitEditDialogProps, 'historyMode'>;
export function VeitOverlayEditDialog(props: VeitOverlayEditDialogProps) {
  return <VeitEditDialog {...props} historyMode="overlay" />;
}

export type VeitSheetEditDialogProps = Omit<VeitEditDialogProps, 'historyMode'>;
export function VeitSheetEditDialog(props: VeitSheetEditDialogProps) {
  return <VeitEditDialog {...props} historyMode="sheet" />;
}

export type VeitEntityActionDialogProps = Omit<VeitActionDialogProps, 'historyMode'>;
export function VeitEntityActionDialog(props: VeitEntityActionDialogProps) {
  return <VeitActionDialog {...props} historyMode="entity" />;
}

export type VeitOverlayActionDialogProps = Omit<VeitActionDialogProps, 'historyMode'>;
export function VeitOverlayActionDialog(props: VeitOverlayActionDialogProps) {
  return <VeitActionDialog {...props} historyMode="overlay" />;
}

export type VeitSheetActionDialogProps = Omit<VeitActionDialogProps, 'historyMode'>;
export function VeitSheetActionDialog(props: VeitSheetActionDialogProps) {
  return <VeitActionDialog {...props} historyMode="sheet" />;
}
