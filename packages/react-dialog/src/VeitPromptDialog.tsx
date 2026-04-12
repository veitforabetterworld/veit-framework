import type { ReactNode } from 'react';
import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { VeitDialog, VeitDialogFooter, useVeitDialogDismiss } from './VeitDialog.js';

export type VeitPromptDialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  placeholder?: string;
  /** Initialer Text beim Öffnen (Standard: leer). */
  initialValue?: string;
  submitLabel: string;
  cancelLabel: string;
  /**
   * Getrimmter Wert. Bei Fehler `throw`en, damit der Dialog offen bleibt;
   * bei Erfolg schließt die Komponente nach dem Aufruf.
   */
  onSubmit: (value: string) => void | Promise<void>;
  closeAriaLabel?: string;
  backdropDismissLabel?: string;
  zIndexBase?: number;
  disabled?: boolean;
  blockBackdropClose?: boolean;
};

type PromptFieldsProps = {
  id: string;
  title: ReactNode;
  submitLabel: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled: boolean;
  canSubmit: boolean;
  onSubmitTrimmed: () => Promise<void>;
};

const PromptFields = forwardRef<HTMLInputElement, PromptFieldsProps>(function PromptFields(
  { id, title, submitLabel, value, onChange, placeholder, disabled, canSubmit, onSubmitTrimmed },
  ref,
) {
  const dismiss = useVeitDialogDismiss();

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="sr-only">
        {typeof title === 'string' ? title : submitLabel}
      </label>
      <input
        ref={ref}
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || !canSubmit || disabled) return;
          e.preventDefault();
          void (async () => {
            try {
              await onSubmitTrimmed();
              dismiss();
            } catch {
              /* Fehler im Aufrufer */
            }
          })();
        }}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className="input w-full"
      />
    </div>
  );
});

export function VeitPromptDialog({
  open,
  onClose,
  title,
  placeholder,
  initialValue = '',
  submitLabel,
  cancelLabel,
  onSubmit,
  closeAriaLabel,
  backdropDismissLabel,
  zIndexBase = 240,
  disabled = false,
  blockBackdropClose = false,
}: VeitPromptDialogProps) {
  const closeLabel = closeAriaLabel ?? cancelLabel;
  const [value, setValue] = useState(initialValue);
  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const canSubmit = value.trim().length > 0;

  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    queueMicrotask(() => inputRef.current?.focus());
  }, [open, initialValue]);

  const submitTrimmed = async () => {
    if (!canSubmit || disabled) return;
    await onSubmit(value.trim());
  };

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
            className="btn-primary min-h-[44px]"
            disabled={disabled || !canSubmit}
            onClick={async () => {
              if (!canSubmit || disabled) return;
              try {
                await submitTrimmed();
                dismiss();
              } catch {
                /* Fehler im Aufrufer */
              }
            }}
          >
            {submitLabel}
          </button>
        </VeitDialogFooter>
      )}
    >
      <PromptFields
        ref={inputRef}
        id={fieldId}
        title={title}
        submitLabel={submitLabel}
        value={value}
        onChange={setValue}
        placeholder={placeholder}
        disabled={disabled}
        canSubmit={canSubmit}
        onSubmitTrimmed={submitTrimmed}
      />
    </VeitDialog>
  );
}
