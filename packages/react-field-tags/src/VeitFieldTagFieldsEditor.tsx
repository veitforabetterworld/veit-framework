import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import type { FieldDef } from '@veit/field-tags';
import { VeitDeleteButton, VeitSettingsToggleRow } from '@veit/react-controls';

import type { VeitFieldTagFieldsStrings } from './types.js';

export type VeitFieldTagFieldsEditorProps = {
  fields: FieldDef[];
  disabled?: boolean;
  busy?: boolean;
  strings: VeitFieldTagFieldsStrings;
  deleteButtonClassName?: string;
  deleteButtonLabel: React.ReactNode;
  newFieldName: string;
  onNewFieldNameChange: (value: string) => void;
  onAddField: () => void | Promise<void>;
  onRenameField: (fieldId: number, name: string) => void | Promise<void>;
  onPatchField: (
    fieldId: number,
    patch: { allow_multiple?: boolean; required?: boolean },
  ) => void | Promise<void>;
  onDeleteField: (fieldId: number) => void | Promise<void>;
  renderTagEditDialog?: (ctx: {
    field: FieldDef;
    open: boolean;
    onClose: () => void;
  }) => React.ReactNode;
};

export function VeitFieldTagFieldsEditor({
  fields,
  disabled,
  busy,
  strings,
  deleteButtonClassName,
  deleteButtonLabel,
  newFieldName,
  onNewFieldNameChange,
  onAddField,
  onRenameField,
  onPatchField,
  onDeleteField,
  renderTagEditDialog,
}: VeitFieldTagFieldsEditorProps) {
  const [editFieldId, setEditFieldId] = useState<number | null>(null);
  const editField = fields.find((f) => f.id === editFieldId) ?? null;

  useEffect(() => {
    if (editFieldId != null && !fields.some((f) => f.id === editFieldId)) {
      setEditFieldId(null);
    }
  }, [editFieldId, fields]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{strings.customFieldsTitle}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{strings.customFieldsHint}</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-[12rem] flex-1">
          <span className="label">{strings.fieldName}</span>
          <input
            className="input"
            value={newFieldName}
            disabled={disabled || busy}
            placeholder={strings.fieldNamePlaceholder}
            onChange={(e) => onNewFieldNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onAddField();
            }}
          />
        </label>
        <button
          type="button"
          className="btn-primary min-h-[44px]"
          disabled={disabled || busy}
          onClick={() => void onAddField()}
        >
          {strings.fieldAdd}
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">{strings.fieldsEmpty}</p>
      ) : (
        <div className="space-y-2">
          {fields.map((field) => (
            <div key={field.id} className="rounded-xl border border-border/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="input min-h-[36px] min-w-[12rem] flex-1 text-sm"
                  defaultValue={field.name}
                  disabled={disabled || busy || field.system_key != null}
                  onBlur={(e) => {
                    if (e.target.value.trim() !== field.name) void onRenameField(field.id, e.target.value);
                  }}
                />
                <button
                  type="button"
                  className="btn-secondary inline-flex min-h-[36px] items-center gap-1.5 px-3 text-sm"
                  disabled={disabled || busy}
                  onClick={() => setEditFieldId(field.id)}
                >
                  <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                  {strings.tagEditButton}
                </button>
                {field.system_key == null ? (
                  <VeitDeleteButton
                    className={deleteButtonClassName}
                    disabled={disabled || busy}
                    deleteConfirm={{
                      title: strings.fieldDeleteConfirmTitle,
                      message: strings.fieldDeleteConfirmMessage,
                      confirmLabel: strings.delete,
                      cancelLabel: strings.cancel,
                      destructive: true,
                    }}
                    onClick={() => void onDeleteField(field.id)}
                  >
                    {deleteButtonLabel}
                  </VeitDeleteButton>
                ) : null}
              </div>
              {field.system_key == null ? (
                <div className="mt-2 space-y-2">
                  <VeitSettingsToggleRow
                    id={`field-${field.id}-allow-multiple`}
                    label={strings.fieldAllowMultiple}
                    checked={field.allow_multiple}
                    disabled={disabled || busy}
                    onCheckedChange={(checked) => void onPatchField(field.id, { allow_multiple: checked })}
                  />
                  <VeitSettingsToggleRow
                    id={`field-${field.id}-required`}
                    label={strings.fieldRequired}
                    checked={field.required}
                    disabled={disabled || busy}
                    onCheckedChange={(checked) => void onPatchField(field.id, { required: checked })}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {editField && renderTagEditDialog
        ? renderTagEditDialog({ field: editField, open: true, onClose: () => setEditFieldId(null) })
        : null}
    </div>
  );
}
