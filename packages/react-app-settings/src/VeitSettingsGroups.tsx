import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  VeitAlert,
  VeitButton,
  VeitField,
  VeitInput,
  VeitList,
  VeitListItem,
  VeitSecretField,
  VeitSelect,
  VeitSettingsSection,
  VeitSettingsToggleRow,
  VeitSpinner,
  type VeitSelectOption,
} from '@veit/react-controls';
import { VeitOverlayEditDialog, useDialogFormBaseline, useManagedOverlayDialogBinding } from '@veit/react-dialog';

/** A value as '@veit/app-settings/express' lists it: the text, or for a secret only whether one is stored. */
export type VeitSettingsValue = string | { stored: boolean };
export type VeitSettingsValues = Record<string, VeitSettingsValue>;

/** What onSave gets per key: the text; for a secret '' keeps the stored one and null deletes it. */
export type VeitSettingsPatch = Record<string, string | null>;

type FieldBase = { key: string; label: string; hint?: ReactNode };

export type VeitSettingsField =
  | (FieldBase & { kind: 'text'; placeholder?: string; autoComplete?: string })
  | (FieldBase & { kind: 'number'; placeholder?: string; min?: number; max?: number })
  /** Stored as '1' or '0'; `defaultOn` when nothing is stored (e.g. the TLS certificate check). */
  | (FieldBase & { kind: 'toggle'; defaultOn?: boolean })
  | (FieldBase & { kind: 'select'; options: readonly VeitSelectOption[] })
  /**
   * Write-only: shown masked, the eye fetches it with onReveal; empty on save keeps the stored one. A stored secret
   * gets a delete button when texts.clearSecret is set (`clearable: false` hides it); deleting sends null.
   */
  | (FieldBase & { kind: 'secret'; placeholder?: string; clearable?: boolean });

export type VeitSettingsGroup = {
  id: string;
  title: string;
  description?: ReactNode;
  fields: readonly VeitSettingsField[];
  /** Line under the title in the list, e.g. "mail.example.org:587". */
  summary?: (values: VeitSettingsValues) => ReactNode;
  /** More content in the popup under the fields, e.g. a test button; `dirty` while the draft is unsaved. */
  extra?: (state: { dirty: boolean; busy: boolean }) => ReactNode;
};

export type VeitSettingsGroupsTexts = {
  save: string;
  cancel: string;
  close: string;
  show: string;
  hide: string;
  copy: string;
  copied: string;
  /** Hint under a secret that is stored ("Gespeichert. Leer lassen, um es zu behalten."). */
  secretStored: string;
  /** While values is null (screen reader label of the spinner). */
  loading: string;
  /** Button that deletes a stored secret; without it there is no button. */
  clearSecret?: string;
  /** Hint under a secret marked for deletion. */
  secretCleared?: string;
  /** Takes the deletion back; default `cancel`. */
  undoClear?: string;
};

export const veitSettingsGroupsTexts: Record<'de' | 'en', VeitSettingsGroupsTexts> = {
  de: {
    save: 'Speichern',
    cancel: 'Abbrechen',
    close: 'Schließen',
    show: 'Anzeigen',
    hide: 'Verbergen',
    copy: 'Kopieren',
    copied: 'Kopiert',
    secretStored: 'Gespeichert. Leer lassen, um es zu behalten.',
    loading: 'Lädt …',
    clearSecret: 'Löschen',
    secretCleared: 'Wird beim Speichern gelöscht.',
    undoClear: 'Behalten',
  },
  en: {
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    show: 'Show',
    hide: 'Hide',
    copy: 'Copy',
    copied: 'Copied',
    secretStored: 'Stored. Leave empty to keep it.',
    loading: 'Loading …',
    clearSecret: 'Delete',
    secretCleared: 'Will be deleted when you save.',
    undoClear: 'Keep',
  },
};

/** The text of a value; '' for a secret. */
export function veitSettingText(values: VeitSettingsValues, key: string): string {
  const value = values[key];
  return typeof value === 'string' ? value : '';
}

/** Whether a secret is stored. */
export function veitSettingStored(values: VeitSettingsValues, key: string): boolean {
  const value = values[key];
  return typeof value === 'object' && value !== null && value.stored;
}

const TRUE_TEXT = new Set(['1', 'true', 'yes', 'on']);

function draftOf(group: VeitSettingsGroup, values: VeitSettingsValues): VeitSettingsPatch {
  return Object.fromEntries(
    group.fields.map((f) => {
      if (f.kind === 'secret') return [f.key, ''];
      const text = veitSettingText(values, f.key).trim();
      if (f.kind !== 'toggle') return [f.key, veitSettingText(values, f.key)];
      const on = text === '' ? Boolean(f.defaultOn) : TRUE_TEXT.has(text.toLowerCase());
      return [f.key, on ? '1' : '0'];
    }),
  );
}

/**
 * Error code per field of a failed save: `fieldErrors` of VeitApiError ('@veit/react-auth', from the body
 * `fields: { key: code }` of '@veit/app-settings/express'), a list `fields`, or the older `key` with `code`.
 */
export function veitSettingsFieldErrors(error: unknown): Record<string, string> {
  if (typeof error !== 'object' || error === null) return {};
  const e = error as { fieldErrors?: unknown; fields?: unknown; key?: unknown; code?: unknown };
  if (typeof e.fieldErrors === 'object' && e.fieldErrors !== null) {
    return Object.fromEntries(Object.entries(e.fieldErrors as Record<string, unknown>).map(([k, v]) => [k, String(v)]));
  }
  const code = typeof e.code === 'string' ? e.code : '';
  if (Array.isArray(e.fields)) return Object.fromEntries(e.fields.map((k) => [String(k), code]));
  if (typeof e.key === 'string') return { [e.key]: code };
  return {};
}

type DialogProps = {
  values: VeitSettingsValues;
  /**
   * Gets every field of the group; secrets are '' when unchanged (keep) and null when deleted. Declared as a method,
   * so a host callback typed with `Record<string, string>` still fits; it sees null only after the delete button.
   */
  onSave(patch: VeitSettingsPatch): Promise<unknown>;
  onReveal?: (key: string) => Promise<string>;
  texts: VeitSettingsGroupsTexts;
  errorText: (error: unknown) => string;
  /** Text at the field for a field error (code and key from the server); default errorText of the whole error. */
  fieldErrorText?: (code: string, key: string) => string | undefined;
};

function SettingsField({
  field,
  value,
  stored,
  error,
  onChange,
  onReveal,
  onRevealError,
  disabled,
  texts,
}: {
  field: VeitSettingsField;
  /** null: a secret marked for deletion. */
  value: string | null;
  stored: boolean;
  error?: string;
  onChange: (value: string | null) => void;
  onReveal?: (key: string) => Promise<string>;
  onRevealError: (error: unknown) => void;
  disabled: boolean;
  texts: VeitSettingsGroupsTexts;
}) {
  const id = `setting-${field.key}`;
  if (field.kind === 'toggle') {
    return (
      <div className="flex flex-col gap-1">
        <VeitSettingsToggleRow
          variant="embed"
          label={field.label}
          description={field.hint}
          checked={value === '1'}
          disabled={disabled}
          onCheckedChange={(on) => onChange(on ? '1' : '0')}
        />
        {error ? (
          <VeitAlert variant="error" plain>
            {error}
          </VeitAlert>
        ) : null}
      </div>
    );
  }
  if (field.kind === 'secret') {
    const cleared = value === null;
    const canClear = stored && !cleared && field.clearable !== false && Boolean(texts.clearSecret);
    const hint = cleared ? (
      <span className="inline-flex flex-wrap items-center gap-2">
        {texts.secretCleared}
        <VeitButton variant="ghost" size="sm" disabled={disabled} onClick={() => onChange('')}>
          {texts.undoClear ?? texts.cancel}
        </VeitButton>
      </span>
    ) : stored ? (
      texts.secretStored
    ) : (
      field.hint
    );
    return (
      <VeitField label={field.label} htmlFor={id} hint={hint} error={error}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <VeitSecretField
              id={id}
              value={value ?? ''}
              onChange={onChange}
              stored={stored && !cleared}
              onReveal={onReveal ? () => onReveal(field.key) : undefined}
              onRevealError={onRevealError}
              showLabel={texts.show}
              hideLabel={texts.hide}
              copyLabel={texts.copy}
              copiedLabel={texts.copied}
              placeholder={field.placeholder}
              disabled={disabled}
            />
          </div>
          {canClear ? (
            <VeitButton variant="secondary" disabled={disabled} onClick={() => onChange(null)}>
              {texts.clearSecret}
            </VeitButton>
          ) : null}
        </div>
      </VeitField>
    );
  }
  const text = value ?? '';
  return (
    <VeitField label={field.label} htmlFor={id} hint={field.hint} error={error}>
      {field.kind === 'select' ? (
        <VeitSelect id={id} value={text} options={field.options} disabled={disabled} onValueChange={onChange} />
      ) : field.kind === 'number' ? (
        <VeitInput
          id={id}
          type="number"
          inputMode="numeric"
          min={field.min}
          max={field.max}
          placeholder={field.placeholder}
          value={text}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <VeitInput
          id={id}
          placeholder={field.placeholder}
          autoComplete={field.autoComplete}
          value={text}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </VeitField>
  );
}

function SettingsEditDialog({
  open,
  group,
  values,
  onClose,
  onSave,
  onReveal,
  texts,
  errorText,
  fieldErrorText,
}: DialogProps & { open: boolean; group: VeitSettingsGroup; onClose: () => void }) {
  const binding = useManagedOverlayDialogBinding(open, onClose);
  // Keyed by id: hosts may build the group objects on every render.
  const initial = useMemo(() => draftOf(group, values), [group.id, values]);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) {
      setDraft(initial);
      setError(null);
      setFieldErrors({});
    }
  }, [open, initial]);
  const { dirty, formBaseline } = useDialogFormBaseline({ draft, resolveBaseline: () => initial, resetDeps: [open, initial], track: open });

  // Errors keep the dialog open: the footer closes it only after a resolved save.
  const save = async () => {
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      await onSave(draft);
    } catch (e) {
      // Errors of fields in this group go to the field, anything else into the box under the fields.
      const byField = Object.entries(veitSettingsFieldErrors(e)).filter(([key]) => group.fields.some((f) => f.key === key));
      if (byField.length > 0) {
        setFieldErrors(Object.fromEntries(byField.map(([key, code]) => [key, fieldErrorText?.(code, key) ?? errorText(e)])));
      } else {
        setError(errorText(e));
      }
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const change = (key: string, value: string | null) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setFieldErrors((errors) => {
      if (!(key in errors)) return errors;
      const rest = { ...errors };
      delete rest[key];
      return rest;
    });
  };

  return (
    <VeitOverlayEditDialog
      binding={binding}
      title={group.title}
      closeAriaLabel={texts.close}
      variant="responsive"
      size="sm"
      disabled={saving}
      blockBackdropClose={saving}
      footerProps={{ busy: saving, dirty, formBaseline, cancelLabel: texts.cancel, saveLabel: texts.save, onSave: save }}
    >
      <div className="flex flex-col gap-4">
        {group.description ? <p className="m-0 text-sm text-muted-foreground">{group.description}</p> : null}
        {group.fields.map((field) => (
          <SettingsField
            key={field.key}
            field={field}
            value={field.key in draft ? draft[field.key] : ''}
            stored={veitSettingStored(values, field.key)}
            error={fieldErrors[field.key]}
            onChange={(value) => change(field.key, value)}
            onReveal={onReveal}
            onRevealError={(e) => setError(errorText(e))}
            disabled={saving}
            texts={texts}
          />
        ))}
        {group.extra?.({ dirty, busy: saving })}
        {error && <VeitAlert variant="error">{error}</VeitAlert>}
      </div>
    </VeitOverlayEditDialog>
  );
}

// Stable while loading: a new {} on every render would reset the draft.
const EMPTY_VALUES: VeitSettingsValues = {};

export type VeitSettingsGroupsProps = Omit<DialogProps, 'values'> & {
  groups: readonly VeitSettingsGroup[];
  /** null while loading: a spinner stands in for the list. */
  values: VeitSettingsValues | null;
  /** With a title the list sits in a VeitSettingsSection card. */
  title?: ReactNode;
  description?: ReactNode;
};

/**
 * Admin settings as a list of groups; a group opens in a popup with a draft (unsaved changes are asked about).
 * onSave gets every field of the group; secrets are '' when unchanged (keep) and null when deleted. Field errors of
 * the server (`fields` of the error) show at the field. The host refreshes `values` after it, e.g. from the answer
 * of PUT in '@veit/app-settings/express'.
 */
export function VeitSettingsGroups({ groups, values, title, description, ...dialog }: VeitSettingsGroupsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = groups.find((g) => g.id === editingId) ?? null;
  const list =
    values === null ? (
      <div className="flex justify-center py-4">
        <VeitSpinner label={dialog.texts.loading} />
      </div>
    ) : (
      <VeitList>
        {groups.map((g) => (
          <VeitListItem
            key={g.id}
            title={g.title}
            meta={g.summary?.(values)}
            trailing={<ChevronRight className="size-4 text-muted-foreground" aria-hidden />}
            onClick={() => setEditingId(g.id)}
          />
        ))}
      </VeitList>
    );
  return (
    <>
      {title != null ? (
        <VeitSettingsSection title={title} description={description}>
          {list}
        </VeitSettingsSection>
      ) : (
        list
      )}
      {/* Stays mounted; the overlay keeps its place in the history while open toggles. */}
      {groups.length > 0 && (
        <SettingsEditDialog
          {...dialog}
          open={values !== null && editing !== null}
          group={editing ?? groups[0]}
          values={values ?? EMPTY_VALUES}
          onClose={() => setEditingId(null)}
        />
      )}
    </>
  );
}
