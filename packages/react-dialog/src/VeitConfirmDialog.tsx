import { type ReactNode } from 'react';
import { VeitDialog, VeitDialogFooter, veitDialogHistoryLog, useVeitDialogNestedZIndexBase } from './VeitDialog.js';

export type VeitConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void | Promise<void>;
  /** Destruktive Aktion: primärer Button in Warnfarben (Tailwind `btn-destructive` o. ä. in der App). */
  destructive?: boolean;
  /** Fallback: {@link cancelLabel} */
  closeAriaLabel?: string;
  backdropDismissLabel?: string;
  zIndexBase?: number;
  disabled?: boolean;
  blockBackdropClose?: boolean;
};

export function VeitConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  destructive = false,
  closeAriaLabel,
  backdropDismissLabel,
  zIndexBase: zIndexBaseProp,
  disabled = false,
  blockBackdropClose = false,
}: VeitConfirmDialogProps) {
  const closeLabel = closeAriaLabel ?? cancelLabel;
  const nestedZ = useVeitDialogNestedZIndexBase();
  const zIndexBase = zIndexBaseProp ?? nestedZ ?? 240;

  return (
    <VeitDialog
      open={open}
      onClose={onClose}
      title={title}
      closeAriaLabel={closeLabel}
      backdropDismissLabel={backdropDismissLabel ?? closeLabel}
      zIndexBase={zIndexBase}
      disabled={disabled}
      blockBackdropClose={blockBackdropClose}
      variant="centered"
      size="sm"
      footer={({ dismiss }) => (
        <VeitDialogFooter>
          <button type="button" className="btn-secondary min-h-[44px]" disabled={disabled} onClick={dismiss}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`min-h-[44px] rounded-lg px-4 text-sm font-medium text-primary-foreground disabled:opacity-50 ${
              destructive ? 'bg-destructive hover:bg-destructive/90' : 'btn-primary'
            }`.trim()}
            disabled={disabled}
            onClick={async () => {
              const labelHint = typeof confirmLabel === 'string' ? confirmLabel : '(confirmLabel)';
              veitDialogHistoryLog('VeitConfirmDialog.confirm.click.beforeDismiss', { labelHint });
              // Zuerst History/UI des Bestätigungsdialogs schließen. Wenn `onConfirm` zuerst lief und z. B.
              // die Zeile mit diesem Button per setState entfernt, unmountet der Dialog ohne dismiss — dann
              // feuert VeitDialog-Cleanup zusätzlich history.back(), und ein späteres dismiss() erzeugt ein
              // zweites Zurück (z. B. ?card= fällt weg).
              dismiss();
              veitDialogHistoryLog('VeitConfirmDialog.confirm.afterDismissBeforeOnConfirm', { labelHint });
              try {
                await onConfirm();
                veitDialogHistoryLog('VeitConfirmDialog.confirm.afterOnConfirm', { labelHint });
              } catch {
                veitDialogHistoryLog('VeitConfirmDialog.confirm.onConfirmThrow', { labelHint });
                return;
              }
            }}
          >
            {confirmLabel}
          </button>
        </VeitDialogFooter>
      )}
    >
      <div className="text-sm text-muted-foreground">{message}</div>
    </VeitDialog>
  );
}
