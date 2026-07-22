import type { ReactNode } from 'react';

/** Konfiguration für die Bestätigung vor einer Lösch-Aktion (Footer oder {@link VeitDeleteButton}). */
export type VeitDeleteConfirmConfig = {
  title: ReactNode;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  closeAriaLabel?: string;
  backdropDismissLabel?: string;
  disabled?: boolean;
  blockBackdropClose?: boolean;
};
