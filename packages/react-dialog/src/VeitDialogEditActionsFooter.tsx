import { useState, type ReactNode } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import type { VeitDeleteConfirmConfig } from './VeitDeleteConfirmConfig.js';
import { VeitConfirmDialog } from './VeitConfirmDialog.js';

type VeitDialogEditActionsFooterCommon = {
  dismiss: () => void;
  busy: boolean;
  cancelLabel: string;
  /**
   * `inline`: nur die Aktionszeile (typisch für `VeitDialog`-`footer`).
   * `sticky-panel`: gleiche Zeile mit oberem Trennstrich für eingebettete Formulare im Dialogkörper.
   */
  variant?: 'inline' | 'sticky-panel';
  className?: string;
};

/** Nur ein Aktions-Button (rechtsbündig), z. B. reine Listen- oder „Fertig“-Picker. */
export type VeitDialogEditActionsFooterDismissOnlyProps = VeitDialogEditActionsFooterCommon & {
  dismissOnly: true;
  /** `secondary`: wie Abbrechen/Schließen. `primary`: z. B. „Fertig“ ohne zweiten Button. */
  dismissOnlyTone?: 'secondary' | 'primary';
};

export type VeitDialogEditActionsFooterDeleteAction = {
  /** `aria-label` und `title` – der Button zeigt nur das Papierkorb-Icon. */
  ariaLabel: string;
  onDelete: () => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  /**
   * Wenn gesetzt: Bestätigungsdialog vor `onDelete`.
   * Wenn nicht gesetzt: `onDelete` direkt beim Klick (z. B. Folgedialog öffnen).
   */
  confirm?: VeitDeleteConfirmConfig;
};

type EditSaveAction =
  | { submitFormId: string; onSave?: () => void | Promise<void> }
  | { submitFormId?: undefined; onSave: () => void | Promise<void> };

export type VeitDialogEditActionsFooterEditProps = VeitDialogEditActionsFooterCommon &
  EditSaveAction & {
    dismissOnly?: false;
    saveLabel: string;
    /**
     * Wenn gesetzt: Speichern ist deaktiviert, solange `dirty === false` (keine Änderungen).
     * Entspricht dem früheren manuellen `saveDisabled={!dirty}`.
     */
    dirty?: boolean;
    /** Zusätzliche Deaktivierung (z. B. Validierung trotz `dirty`). */
    saveDisabled?: boolean;
    /** Links, z. B. Zusatz-Aktionen. Wird ignoriert, wenn `deleteAction` gesetzt ist. */
    leading?: ReactNode;
    /** Eingebauter Löschen-Button links (Bestätigung optional). */
    deleteAction?: VeitDialogEditActionsFooterDeleteAction;
  };

export type VeitDialogEditActionsFooterProps =
  | VeitDialogEditActionsFooterDismissOnlyProps
  | VeitDialogEditActionsFooterEditProps;

function VeitDialogEditActionsFooterDeleteTrigger({
  ariaLabel,
  onDelete,
  disabled = false,
  className = '',
  confirm,
  busy,
}: VeitDialogEditActionsFooterDeleteAction & { busy: boolean }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const mergedDisabled = disabled || busy;

  const runDelete = async () => {
    await Promise.resolve(onDelete());
  };

  const presetClass =
    'inline-flex h-10 w-10 shrink-0 items-center justify-center p-0 btn-destructive';
  const btnClass = `${presetClass} ${className}`.trim();

  return (
    <>
      <button
        type="button"
        className={btnClass}
        aria-label={ariaLabel}
        title={ariaLabel}
        disabled={mergedDisabled}
        onClick={
          confirm
            ? (e) => {
                e.preventDefault();
                if (mergedDisabled) return;
                setConfirmOpen(true);
              }
            : (e) => {
                e.preventDefault();
                if (mergedDisabled) return;
                void runDelete();
              }
        }
      >
        <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
      </button>
      {confirm ? (
        <VeitConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          cancelLabel={confirm.cancelLabel}
          destructive={confirm.destructive ?? true}
          closeAriaLabel={confirm.closeAriaLabel}
          backdropDismissLabel={confirm.backdropDismissLabel}
          zIndexBase={confirm.zIndexBase}
          disabled={mergedDisabled || (confirm.disabled ?? false)}
          blockBackdropClose={confirm.blockBackdropClose}
          onConfirm={runDelete}
        />
      ) : null}
    </>
  );
}

/**
 * Einheitliche Fußzeile: optional Löschen links, Abbrechen, Speichern.
 * Speichern ist deaktiviert bei `busy`, bei `dirty === false` (falls `dirty` gesetzt) und bei `saveDisabled`.
 */
export function VeitDialogEditActionsFooter(props: VeitDialogEditActionsFooterProps) {
  const {
    dismiss,
    busy,
    cancelLabel,
    variant = 'inline',
    className = '',
  } = props;

  if (props.dismissOnly) {
    const tone = props.dismissOnlyTone ?? 'secondary';
    const onlyBtnClass =
      tone === 'primary'
        ? 'btn-primary min-h-[2.75rem] w-full sm:w-auto'
        : 'btn-secondary min-h-[2.75rem] w-full sm:w-auto';
    const innerDismiss = (
      <div className={`flex flex-col gap-2 ${className}`.trim()}>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={onlyBtnClass} disabled={busy} onClick={dismiss}>
            {cancelLabel}
          </button>
        </div>
      </div>
    );
    if (variant === 'sticky-panel') {
      return <div className="border-t border-border/40 pt-4">{innerDismiss}</div>;
    }
    return innerDismiss;
  }

  const {
    onSave,
    submitFormId,
    saveLabel,
    dirty,
    saveDisabled = false,
    leading,
    deleteAction,
  } = props;

  const savePrimaryDisabled =
    busy || Boolean(saveDisabled) || (dirty !== undefined ? !dirty : false);

  const saveButton =
    submitFormId != null && submitFormId !== '' ? (
      <button
        type="submit"
        form={submitFormId}
        className="btn-primary order-1 inline-flex min-h-[2.75rem] w-full items-center justify-center gap-2 sm:order-2 sm:w-auto"
        disabled={savePrimaryDisabled}
      >
        {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
        {saveLabel}
      </button>
    ) : (
      <button
        type="button"
        className="btn-primary order-1 inline-flex min-h-[2.75rem] w-full items-center justify-center gap-2 sm:order-2 sm:w-auto"
        disabled={savePrimaryDisabled}
        onClick={() => void onSave?.()}
      >
        {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
        {saveLabel}
      </button>
    );

  const leftSlot =
    deleteAction != null ? (
      <VeitDialogEditActionsFooterDeleteTrigger {...deleteAction} busy={busy} />
    ) : (
      leading
    );

  const inner = (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      <div
        className={
          leftSlot != null
            ? 'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'
            : 'flex flex-col gap-2 sm:flex-row sm:justify-end'
        }
      >
        {leftSlot != null ? <div className="flex shrink-0 items-start">{leftSlot}</div> : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-2">
          <button
            type="button"
            className="btn-secondary order-2 min-h-[2.75rem] w-full sm:order-1 sm:w-auto"
            disabled={busy}
            onClick={dismiss}
          >
            {cancelLabel}
          </button>
          {saveButton}
        </div>
      </div>
    </div>
  );

  if (variant === 'sticky-panel') {
    return <div className="border-t border-border/40 pt-4">{inner}</div>;
  }

  return inner;
}
