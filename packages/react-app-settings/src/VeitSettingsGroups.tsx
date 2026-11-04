import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  VeitAlert,
  VeitField,
  VeitInput,
  VeitList,
  VeitListItem,
  VeitSecretField,
  VeitSelect,
  VeitSettingsSection,
  VeitSettingsToggleRow,
  type VeitSelectOption,
} from '@veit/react-controls';
import { VeitOverlayEditDialog, useDialogFormBaseline, useManagedOverlayDialogBinding } from '@veit/react-dialog';

/** A value as '@veit/app-settings/express' lists it: the text, or for a secret only whether one is stored. */
export type VeitSettingsValue = string | { stored: boolean };
export type VeitSettingsValues = Record<string, VeitSettingsValue>;

type FieldBase = { key: string; label: string; hint?: ReactNode };

export type VeitSettingsField =
  | (FieldBase & { kind: 'text'; placeholder?: string; autoComplete?: string })
  | (FieldBase & { kind: 'number'; placeholder?: string; min?: number; max?: number })
  /** Stored as '1' or '0'. */
  | (FieldBase & { kind: 'toggle' })
  | (FieldBase & { kind: 'select'; options: readonly VeitSelectOption[] })
  /** Write-only: shown masked, the eye fetches it with onReveal; empty on save keeps the stored one. */
  | (FieldBase & { kind: 'secret'; placeholder?: string });

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
  /** While values is null. */
  loading: string;
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

function draftOf(group: VeitSettingsGroup, values: VeitSettingsValues): Record<string, string> {
  return Object.fromEntries(
    group.fields.map((f) => {
      if (f.kind === 'secret') return [f.key, ''];
      const text = veitSettingText(values, f.key);
      return [f.key, f.kind === 'toggle' ? (text === '1' || text === 'true' ? '1' : '0') : text];
    }),
  );
}

type DialogProps = {
  values: VeitSettingsValues;
  onSave: (patch: Record<string, string>) => Promise<unknown>;
  onReveal?: (key: string) => Promise<string>;
  texts: VeitSettingsGroupsTexts;
  errorText: (error: unknown) => string;
};

function SettingsField({
  field,
  value,
  stored,
  onChange,
  onReveal,
  onRevealError,
  disabled,
  texts,
}: {
  field: VeitSettingsField;
  value: string;
  stored: boolean;
  onChange: (value: string) => void;
  onReveal?: (key: string) => Promise<string>;
  onRevealError: (error: unknown) => void;
  disabled: boolean;
  texts: VeitSettingsGroupsTexts;
}) {
  const id = `setting-${field.key}`;
  if (field.kind === 'toggle') {
    return (
      <VeitSettingsToggleRow
        variant="embed"
        label={field.label}
        description={field.hint}
        checked={value === '1'}
        disabled={disabled}
        onCheckedChange={(on) => onChange(on ? '1' : '0')}
      />
    );
  }
  const hint = field.kind === 'secret' && stored ? texts.secretStored : field.hint;
  return (
    <VeitField label={field.label} htmlFor={id} hint={hint}>
      {field.kind === 'secret' ? (
        <VeitSecretField
          id={id}
          value={value}
          onChange={onChange}
          stored={stored}
          onReveal={onReveal ? () => onReveal(field.key) : undefined}
          onRevealError={onRevealError}
          showLabel={texts.show}
          hideLabel={texts.hide}
          copyLabel={texts.copy}
          copiedLabel={texts.copied}
          placeholder={field.placeholder}
          disabled={disabled}
        />
      ) : field.kind === 'select' ? (
        <VeitSelect id={id} value={value} options={field.options} disabled={disabled} onValueChange={onChange} />
      ) : field.kind === 'number' ? (
        <VeitInput
          id={id}
          type="number"
          inputMode="numeric"
          min={field.min}
          max={field.max}
          placeholder={field.placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <VeitInput
          id={id}
          placeholder={field.placeholder}
          autoComplete={field.autoComplete}
          value={value}
          disabled={disabled}
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
}: DialogProps & { open: boolean; group: VeitSettingsGroup; onClose: () => void }) {
  const binding = useManagedOverlayDialogBinding(open, onClose);
  // Keyed by id: hosts may build the group objects on every render.
  const initial = useMemo(() => draftOf(group, values), [group.id, values]);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setDraft(initial);
      setError(null);
    }
  }, [open, initial]);
  const { dirty, formBaseline } = useDialogFormBaseline({ draft, resolveBaseline: () => initial, resetDeps: [open, initial], track: open });

  // Errors keep the dialog open: the footer closes it only after a resolved save.
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
    } catch (e) {
      setError(errorText(e));
      throw e;
    } finally {
      setSaving(false);
    }
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
            value={draft[field.key] ?? ''}
            stored={veitSettingStored(values, field.key)}
            onChange={(value) => setDraft((d) => ({ ...d, [field.key]: value }))}
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

export type VeitSettingsGroupsProps = DialogProps & {
  groups: readonly VeitSettingsGroup[];
  /** null while loading. */
  values: VeitSettingsValues | null;
  /** With a title the list sits in a VeitSettingsSection card. */
  title?: ReactNode;
  description?: ReactNode;
};

/**
 * Admin settings as a list of groups; a group opens in a popup with a draft (unsaved changes are asked about).
 * onSave gets every field of the group; secrets are '' when unchanged (keep). The host refreshes `values` after it,
 * e.g. from the answer of PUT in '@veit/app-settings/express'.
 */
export function VeitSettingsGroups({ groups, values, title, description, ...dialog }: VeitSettingsGroupsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = groups.find((g) => g.id === editingId) ?? null;
  const list =
    values === null ? (
      <p className="m-0 text-sm text-muted-foreground">{dialog.texts.loading}</p>
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
          values={values ?? {}}
          onClose={() => setEditingId(null)}
        />
      )}
    </>
  );
}
