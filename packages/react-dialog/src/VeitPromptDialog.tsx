import { useEffect, useId, useState } from 'react';
import { VeitDialog, VeitDialogFooter } from './VeitDialog.js';

export type VeitPromptDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel: string;
  cancelLabel: string;
  zIndexBase?: number;
  backdropDismissLabel: string;
  inputRequired?: boolean;
  onSubmit: (value: string) => void | Promise<void>;
};

export function VeitPromptDialog({
  open,
  onClose,
  title,
  label,
  placeholder,
  initialValue = '',
  submitLabel,
  cancelLabel,
  zIndexBase = 200,
  backdropDismissLabel,
  inputRequired = true,
  onSubmit,
}: VeitPromptDialogProps) {
  const inputId = useId();
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const inactive = busy;
  const canSubmit = !inputRequired || value.trim().length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onSubmit(value.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <VeitDialog
      open={open}
      onClose={onClose}
      title={title}
      closeAriaLabel={backdropDismissLabel}
      zIndexBase={zIndexBase}
      disabled={inactive}
      variant="centered"
      size="sm"
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
            className="btn-primary min-h-[2.75rem] w-full sm:w-auto"
            disabled={inactive || !canSubmit}
            onClick={() => void submit()}
          >
            {busy ? '…' : submitLabel}
          </button>
        </VeitDialogFooter>
      )}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {label ? (
          <label htmlFor={inputId} className="label mb-1 block">
            {label}
          </label>
        ) : null}
        <input
          id={inputId}
          type="text"
          className="input min-h-[2.75rem] w-full text-base sm:text-sm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={inactive}
          autoComplete="off"
          autoFocus
        />
      </form>
    </VeitDialog>
  );
}
