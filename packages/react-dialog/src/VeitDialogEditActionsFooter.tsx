import { useCallback, useState, type ReactNode } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import type { VeitDeleteConfirmConfig } from './VeitDeleteConfirmConfig.js';
import { VeitConfirmDialog } from './VeitConfirmDialog.js';
import { useVeitDialogRegisterUnsavedDirty, useVeitDialogRegisterUnsavedSave, useVeitDialogDismissAfterSave } from './VeitDialog.js';
import { applyDialogSaveSuccess, type DialogFormBaselineBinding } from './dialogFormDirty.js';

type VeitDialogEditActionsFooterCommon = {
  dismiss: () => void;
  busy: boolean;
  cancelLabel: string;
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
  | {
      submitFormId: string;
      /** Optional — bei `submitFormId` schließt das Form-`onSubmit` selbst (z. B. via `useVeitDialogDismissAfterSave`). */
      onSave?: () => void | Promise<void>;
    }
  | {
      submitFormId?: undefined;
      /**
       * Nur persistieren — nicht `onClose`/`dismiss` aufrufen.
       * Der Footer ruft nach Erfolg automatisch `dismissAfterSave` auf.
       */
      onSave: () => void | Promise<void>;
    };

export type VeitDialogEditActionsFooterEditProps = VeitDialogEditActionsFooterCommon &
  EditSaveAction & {
    dismissOnly?: false;
    saveLabel: string;
    /**
     * Steuert „Ungespeicherte Änderungen“ beim Schließen (via {@link useVeitDialogRegisterUnsavedDirty}).
     * Vergleich Draft vs. Baseline beim Öffnen – nicht „irgendein Feld befüllt“.
     */
    dirty?: boolean;
    /**
     * Speichern nur bei `dirty === true` deaktivieren. Standard: `true` (Edit-Dialoge).
     * Create-Dialoge: `false`, damit Speichern mit gültigen Voreinstellungen sofort möglich ist.
     */
    saveRequiresDirty?: boolean;
    /**
     * Nach erfolgreichem Speichern Baseline = aktueller Draft (dirty → false).
     * Typisch via {@link useDialogFormBaseline}.
     */
    formBaseline?: DialogFormBaselineBinding;
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
  dismissAfterSuccess,
}: VeitDialogEditActionsFooterDeleteAction & {
  busy: boolean;
  dismissAfterSuccess: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const mergedDisabled = disabled || busy;

  const runDelete = async () => {
    try {
      await Promise.resolve(onDelete());
      setConfirmOpen(false);
      dismissAfterSuccess();
    } catch {
      /* Fehler → Hauptdialog bleibt offen (wie beim Speichern). */
    }
  };

  /** Gleiche Mindesthöhe wie `.btn-primary` / `.btn-secondary` (`min-h-[44px]`), damit die Zeile optisch fluchtet. */
  const presetClass =
    'inline-flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center p-0 btn-destructive';
  const btnClass = `${presetClass} ${className}`.trim();

  return (
    <div className="inline-flex shrink-0 items-center">
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
    </div>
  );
}

/**
 * Einheitliche Fußzeile: optional Löschen links, Abbrechen, Speichern.
 * Speichern ist deaktiviert bei `busy`, bei `saveDisabled` und – falls `saveRequiresDirty !== false` –
 * bei `dirty === false` (wenn `dirty` gesetzt).
 */
export function VeitDialogEditActionsFooter(props: VeitDialogEditActionsFooterProps) {
  const { dismiss, busy, cancelLabel, className = '' } = props;
  const dismissAfterSave = useVeitDialogDismissAfterSave();
  const isDismissOnly = 'dismissOnly' in props && props.dismissOnly;
  const dirtyForRegister =
    isDismissOnly ? undefined : (props as VeitDialogEditActionsFooterEditProps).dirty;
  const regSubmitFormId = !isDismissOnly
    ? (props as VeitDialogEditActionsFooterEditProps).submitFormId
    : undefined;
  const regOnSave = !isDismissOnly ? (props as VeitDialogEditActionsFooterEditProps).onSave : undefined;
  const regFormBaseline = !isDismissOnly
    ? (props as VeitDialogEditActionsFooterEditProps).formBaseline
    : undefined;

  const requestSave = useCallback(async (): Promise<void> => {
    if (isDismissOnly) return;
    if (regSubmitFormId != null && regSubmitFormId !== '') {
      const el = document.getElementById(regSubmitFormId);
      if (el instanceof HTMLFormElement) {
        el.requestSubmit();
      }
      return;
    }
    if (regOnSave) {
      await Promise.resolve(regOnSave());
      applyDialogSaveSuccess({
        formBaseline: regFormBaseline,
        dismiss: dismissAfterSave,
      });
      return;
    }
    return;
  }, [isDismissOnly, regSubmitFormId, regOnSave, regFormBaseline, dismissAfterSave]);

  useVeitDialogRegisterUnsavedDirty(dirtyForRegister);
  useVeitDialogRegisterUnsavedSave(isDismissOnly ? null : requestSave);

  if (props.dismissOnly) {
    const tone = props.dismissOnlyTone ?? 'secondary';
    const onlyBtnClass = `${tone === 'primary' ? 'btn-primary' : 'btn-secondary'} w-auto`.trim();
    return (
      <div className={`flex flex-col gap-2 ${className}`.trim()}>
        <div className="flex flex-row flex-wrap justify-end gap-2">
          <button type="button" className={onlyBtnClass} disabled={busy} onClick={dismiss}>
            {cancelLabel}
          </button>
        </div>
      </div>
    );
  }

  const {
    onSave,
    submitFormId,
    saveLabel,
    dirty,
    formBaseline,
    saveDisabled = false,
    saveRequiresDirty = true,
    leading,
    deleteAction,
  } = props;

  const runSave = async () => {
    if (submitFormId != null && submitFormId !== '') {
      const el = document.getElementById(submitFormId);
      if (el instanceof HTMLFormElement) {
        el.requestSubmit();
      }
      return;
    }
    if (onSave) {
      await Promise.resolve(onSave());
      applyDialogSaveSuccess({
        formBaseline,
        dismiss: dismissAfterSave,
      });
    }
  };

  const savePrimaryDisabled =
    busy ||
    Boolean(saveDisabled) ||
    (saveRequiresDirty !== false && dirty !== undefined ? !dirty : false);

  const saveButton =
    submitFormId != null && submitFormId !== '' ? (
      <button
        type="submit"
        form={submitFormId}
        className="btn-primary inline-flex w-auto items-center justify-center gap-2"
        disabled={savePrimaryDisabled}
      >
        {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
        {saveLabel}
      </button>
    ) : (
      <button
        type="button"
        className="btn-primary inline-flex w-auto items-center justify-center gap-2"
        disabled={savePrimaryDisabled}
        onClick={() => void runSave()}
      >
        {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
        {saveLabel}
      </button>
    );

  const leftSlot =
    deleteAction != null ? (
      <VeitDialogEditActionsFooterDeleteTrigger
        {...deleteAction}
        busy={busy}
        dismissAfterSuccess={dismissAfterSave}
      />
    ) : (
      leading
    );

  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      <div
        className={
          leftSlot != null
            ? 'flex w-full min-w-0 flex-row flex-wrap items-center justify-between gap-2'
            : 'flex w-full min-w-0 flex-col gap-2'
        }
      >
        {leftSlot != null ? (
          <div className="flex shrink-0 items-center">{leftSlot}</div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-row flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="btn-secondary w-auto"
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
}
