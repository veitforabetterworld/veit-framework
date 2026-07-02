import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { FieldTag } from '@veit/field-tags';
import {
  VeitDialog,
  VeitDialogEditActionsFooter,
  type VeitDeleteConfirmConfig,
  type VeitDialogUnsavedChangesConfirm,
} from '@veit/react-dialog';

import { VeitFieldTagListEditor, flatDraftRowsEqual, nestedDraftRowsEqual } from './VeitFieldTagListEditor.js';
import {
  cloneFlatDraftRows,
  cloneNestedDraftRows,
  type FlatTagDraft,
  type NestedTagDraft,
  type VeitFieldTagEditDialogStrings,
  type VeitFieldTagListStrings,
} from './types.js';

export type VeitFieldTagEditDialogProps =
  | {
      mode?: 'flat';
      open: boolean;
      onClose: () => void;
      title: string;
      loadTags: () => Promise<FlatTagDraft[]>;
      onSave: (rows: FlatTagDraft[], baseline: FlatTagDraft[]) => Promise<void>;
      canWrite?: boolean;
      disabled?: boolean;
      defaultHex: string;
      strings: VeitFieldTagListStrings & VeitFieldTagEditDialogStrings;
      deleteConfirm: (item: FlatTagDraft) => VeitDeleteConfirmConfig;
      zIndexBase?: number;
      unsavedChangesConfirm?: VeitDialogUnsavedChangesConfirm | null;
      dialogTitle?: never;
    }
  | {
      mode: 'nested';
      open: boolean;
      onClose: () => void;
      title: string;
      fieldId: number;
      loadTags: () => Promise<FieldTag[]>;
      onSave: (rows: NestedTagDraft[], baseline: NestedTagDraft[]) => Promise<void>;
      disabled?: boolean;
      defaultHex?: string;
      strings: VeitFieldTagListStrings & VeitFieldTagEditDialogStrings;
      deleteConfirm: (item: NestedTagDraft) => VeitDeleteConfirmConfig;
      deleteButtonClassName?: string;
      deleteButtonLabel: React.ReactNode;
      zIndexBase?: number;
      unsavedChangesConfirm?: VeitDialogUnsavedChangesConfirm | null;
    };

export function VeitFieldTagEditDialog(props: VeitFieldTagEditDialogProps) {
  const { open, onClose, title, strings, zIndexBase = 240 } = props;
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [focusRowId, setFocusRowId] = useState<string | number | null>(null);

  const [flatRows, setFlatRows] = useState<FlatTagDraft[]>([]);
  const [flatBaseline, setFlatBaseline] = useState<FlatTagDraft[]>([]);
  const [nestedRows, setNestedRows] = useState<NestedTagDraft[]>([]);
  const [nestedBaseline, setNestedBaseline] = useState<NestedTagDraft[]>([]);

  const isNested = props.mode === 'nested';

  const load = useCallback(async () => {
    if (isNested) {
      const tags = await props.loadTags();
      const copy = cloneNestedDraftRows(tags);
      setNestedRows(copy);
      setNestedBaseline(cloneNestedDraftRows(tags));
      return;
    }
    const tags = await props.loadTags();
    const copy = cloneFlatDraftRows(tags);
    setFlatRows(copy);
    setFlatBaseline(cloneFlatDraftRows(tags));
  }, [isNested, props]);

  useEffect(() => {
    if (!open) {
      setFlatRows([]);
      setFlatBaseline([]);
      setNestedRows([]);
      setNestedBaseline([]);
      setLoadError(null);
      setLocalError(null);
      setFocusRowId(null);
      setBusy(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) {
          setLoadError((e as Error).message);
          setFlatRows([]);
          setNestedRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, load]);

  const dirty = useMemo(() => {
    if (isNested) return !nestedDraftRowsEqual(nestedRows, nestedBaseline);
    return !flatDraftRowsEqual(flatRows, flatBaseline, props.defaultHex);
  }, [flatBaseline, flatRows, isNested, nestedBaseline, nestedRows, props]);

  const flushSave = useCallback(async () => {
    if (props.disabled || busy) return;
    setBusy(true);
    setLocalError(null);
    try {
      if (isNested) {
        await props.onSave(nestedRows, nestedBaseline);
      } else if (props.canWrite !== false) {
        await props.onSave(flatRows, flatBaseline);
      }
      onClose();
    } catch (e) {
      setLocalError((e as Error).message);
      try {
        await load();
      } catch {
        /* ignore reload failure */
      }
    } finally {
      setBusy(false);
    }
  }, [busy, flatBaseline, flatRows, isNested, load, nestedBaseline, nestedRows, onClose, props]);

  const showEditor = !loading && !loadError;
  const canWrite = isNested ? !props.disabled : props.canWrite !== false;

  if (!open) return null;

  return (
    <VeitDialog
      open
      onClose={busy ? () => {} : onClose}
      title={title}
      closeAriaLabel={strings.close}
      zIndexBase={zIndexBase}
      unsavedChangesConfirm={props.unsavedChangesConfirm}
      variant="responsive"
      size={isNested ? 'md' : 'lg'}
      disabled={busy}
      blockBackdropClose={busy}
      footer={
        showEditor && canWrite
          ? ({ dismiss }) => (
              <VeitDialogEditActionsFooter
                dismiss={dismiss}
                onSave={() => void flushSave()}
                busy={busy}
                dirty={dirty}
                cancelLabel={strings.cancel}
                saveLabel={strings.save}
              />
            )
          : undefined
      }
    >
      {loading ? (
        <div className="flex min-h-[120px] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        </div>
      ) : loadError ? (
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          {localError ? (
            <p className="text-sm text-destructive" role="alert">
              {localError}
            </p>
          ) : null}
          {isNested ? (
            <VeitFieldTagListEditor
              mode="nested"
              fieldId={props.fieldId}
              items={nestedRows}
              onItemsChange={setNestedRows}
              disabled={props.disabled || busy}
              defaultHex={props.defaultHex}
              strings={props.strings}
              deleteConfirm={props.deleteConfirm}
              deleteButtonClassName={props.deleteButtonClassName}
              deleteButtonLabel={props.deleteButtonLabel}
            />
          ) : (
            <VeitFieldTagListEditor
              items={flatRows}
              onItemsChange={(rows) => {
                setFlatRows(rows);
                const last = rows[rows.length - 1];
                if (last && typeof last.id === 'string' && last.name === '') setFocusRowId(last.id);
              }}
              canWrite={canWrite}
              disabled={loading || busy}
              defaultHex={props.defaultHex}
              strings={props.strings}
              confirmZIndexBase={zIndexBase + 10}
              focusRowId={focusRowId}
              onFocusRowIdConsumed={() => setFocusRowId(null)}
              deleteConfirm={props.deleteConfirm}
            />
          )}
        </div>
      )}
    </VeitDialog>
  );
}
