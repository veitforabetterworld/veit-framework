import { useEffect, useId, useState, type ReactNode } from 'react';
import { VeitDialog, VeitDialogFooter } from './VeitDialog.js';

export type VeitConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  disabled?: boolean;
  zIndexBase?: number;
  backdropDismissLabel: string;
  blockBackdropClose?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function VeitConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  disabled = false,
  zIndexBase = 200,
  backdropDismissLabel,
  blockBackdropClose = false,
  onConfirm,
}: VeitConfirmDialogProps) {
  const descId = useId();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  const inactive = disabled || busy;

  const runConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <VeitDialog
      open={open}
      onClose={onClose}
      title={title}
      ariaDescribedBy={descId}
      closeAriaLabel={backdropDismissLabel}
      zIndexBase={zIndexBase}
      blockBackdropClose={blockBackdropClose || inactive}
      disabled={inactive}
      variant="centered"
      size="sm"
      role="alertdialog"
      showCloseButton
      backdropBlur={false}
      backdropClassName="bg-black/40"
      headerClassName="px-4 py-3 sm:px-4"
      bodyClassName="!px-4 !py-3 sm:!px-4 sm:!py-3"
      footer={({ dismiss }) => (
        <VeitDialogFooter>
          <button
            type="button"
            className="btn-secondary min-h-[2.75rem] w-full sm:w-auto"
            disabled={inactive}
            onClick={dismiss}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`min-h-[2.75rem] w-full sm:w-auto ${destructive ? 'btn-destructive' : 'btn-primary'}`}
            disabled={inactive}
            onClick={() => void runConfirm()}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </VeitDialogFooter>
      )}
    >
      <div id={descId} className="text-sm text-muted-foreground">
        {message}
      </div>
    </VeitDialog>
  );
}
