import { createContext, useContext, type ReactNode } from 'react';
import {
  VEIT_DIALOG_UNSAVED_CHANGES_DEFAULTS_EN,
  type VeitDialogUnsavedChangesConfirm,
} from './VeitDialog.js';

export type VeitDialogUnsavedConfirmStrings = {
  title: string;
  message: string;
  saveLabel: string;
  confirmLabel: string;
  cancelLabel: string;
  closeAriaLabel?: string;
  backdropDismissLabel?: string;
  destructive?: boolean;
  zIndexBase?: number;
};

export function createVeitDialogUnsavedConfirm(
  strings: VeitDialogUnsavedConfirmStrings,
): VeitDialogUnsavedChangesConfirm {
  return {
    title: strings.title,
    message: strings.message,
    saveLabel: strings.saveLabel,
    confirmLabel: strings.confirmLabel,
    cancelLabel: strings.cancelLabel,
    closeAriaLabel: strings.closeAriaLabel ?? strings.cancelLabel,
    backdropDismissLabel: strings.backdropDismissLabel ?? strings.closeAriaLabel ?? strings.cancelLabel,
    destructive: strings.destructive ?? true,
    zIndexBase: strings.zIndexBase,
  };
}

const VeitDialogUnsavedConfirmContext = createContext<VeitDialogUnsavedChangesConfirm | undefined>(
  undefined,
);

export function VeitDialogUnsavedConfirmProvider({
  value,
  children,
}: {
  value: VeitDialogUnsavedChangesConfirm | undefined;
  children: ReactNode;
}) {
  return (
    <VeitDialogUnsavedConfirmContext.Provider value={value}>
      {children}
    </VeitDialogUnsavedConfirmContext.Provider>
  );
}

export function useVeitDialogUnsavedConfirmFromProvider(): VeitDialogUnsavedChangesConfirm | undefined {
  return useContext(VeitDialogUnsavedConfirmContext);
}

function isFullUnsavedConfirm(
  value: VeitDialogUnsavedChangesConfirm | Partial<VeitDialogUnsavedChangesConfirm>,
): value is VeitDialogUnsavedChangesConfirm {
  return typeof value.title === 'string' && typeof value.message === 'string';
}

export type VeitDialogUnsavedConfirmOverride =
  | VeitDialogUnsavedChangesConfirm
  | Partial<VeitDialogUnsavedChangesConfirm>
  | null;

/** `edit`: Provider → EN-Fallback; `action`: standardmäßig aus. `null` schaltet ab. */
export function resolveVeitDialogUnsavedConfirm(
  override: VeitDialogUnsavedConfirmOverride | undefined,
  preset: 'edit' | 'action',
  fromProvider: VeitDialogUnsavedChangesConfirm | undefined,
): VeitDialogUnsavedChangesConfirm | null | undefined {
  if (override === null) return null;

  const defaultEdit = fromProvider ?? VEIT_DIALOG_UNSAVED_CHANGES_DEFAULTS_EN;

  if (override !== undefined) {
    if (isFullUnsavedConfirm(override)) return override;
    const base = preset === 'action' ? VEIT_DIALOG_UNSAVED_CHANGES_DEFAULTS_EN : defaultEdit;
    return { ...base, ...override };
  }

  if (preset === 'action') return null;
  return defaultEdit;
}

export function useResolvedVeitDialogUnsavedConfirm(
  override: VeitDialogUnsavedConfirmOverride | undefined,
  preset: 'edit' | 'action',
): VeitDialogUnsavedChangesConfirm | null | undefined {
  const fromProvider = useVeitDialogUnsavedConfirmFromProvider();
  return resolveVeitDialogUnsavedConfirm(override, preset, fromProvider);
}
