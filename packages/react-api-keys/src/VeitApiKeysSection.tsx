import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Copy, Eye, EyeOff, Loader2 } from 'lucide-react';
import { VeitAccountSection } from '@veit/react-account';
import {
  VEIT_SETTINGS_ACTIONS,
  VeitButton,
  VeitField,
  VeitInput,
  VeitList,
  VeitListItem,
  VeitSettingsToggleRow,
  VeitStatusBadge,
  veitPasswordToggleButtonClass,
} from '@veit/react-controls';
import {
  VeitOverlayDialog,
  VeitOverlayEditDialog,
  useDialogFormBaseline,
  useManagedOverlayDialogBinding,
} from '@veit/react-dialog';

/** A key as the Express adapter of '@veit/api-keys' sends it. */
export type VeitApiKey = {
  id: string;
  label: string;
  prefix: string;
  permissions: string[];
  all_resources: boolean;
  resources: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  /** Stored encrypted on the server (`secret` of '@veit/api-keys'), so `reveal` can show it again. */
  revealable?: boolean;
};

export type VeitApiKeyInput = {
  label: string;
  permissions: string[];
  all_resources: boolean;
  resources: string[];
};

export type VeitApiKeysClient = {
  list: () => Promise<VeitApiKey[]>;
  create: (input: VeitApiKeyInput) => Promise<{ key: string; apiKey: VeitApiKey }>;
  update: (id: string, patch: Partial<VeitApiKeyInput>) => Promise<VeitApiKey>;
  revoke: (id: string) => Promise<void>;
  /** The plain key of a revealable key. */
  reveal?: (id: string) => Promise<string>;
};

type FetchJson = <T>(url: string, init?: { method?: string; body?: unknown }) => Promise<T>;

/** Client for /me/api-keys of '@veit/api-keys/express' at baseUrl; fetchJson is veitFetchJson from '@veit/react-auth'. */
export function createRestApiKeysClient(baseUrl: string, fetchJson: FetchJson): VeitApiKeysClient {
  const url = (path: string) => `${baseUrl.replace(/\/$/, '')}${path}`;
  return {
    list: async () => (await fetchJson<{ keys: VeitApiKey[] }>(url('/me/api-keys'))).keys,
    create: async (input) => {
      const r = await fetchJson<{ key: string; api_key: VeitApiKey }>(url('/me/api-keys'), { method: 'POST', body: input });
      return { key: r.key, apiKey: r.api_key };
    },
    update: (id, patch) => fetchJson<VeitApiKey>(url(`/me/api-keys/${encodeURIComponent(id)}`), { method: 'PATCH', body: patch }),
    revoke: async (id) => {
      await fetchJson(url(`/me/api-keys/${encodeURIComponent(id)}`), { method: 'DELETE' });
    },
    reveal: async (id) => (await fetchJson<{ key: string }>(url(`/me/api-keys/${encodeURIComponent(id)}/key`))).key,
  };
}

export type VeitApiKeysTexts = {
  title: string;
  description: string;
  empty: string;
  create: string;
  edit: string;
  save: string;
  cancel: string;
  revoke: string;
  revokeTitle: string;
  revokeConfirm: string;
  revoked: string;
  label: string;
  permissions: string;
  scope: string;
  scopeAll: string;
  scopeSome: string;
  scopeSomeHint: string;
  noResources: string;
  newKey: string;
  newKeyHint: string;
  /** Under the key when it can not be shown again. */
  notRevealable: string;
  key: string;
  show: string;
  hide: string;
  copy: string;
  copied: string;
  close: string;
  lastUsed: string;
  never: string;
  /** "{n} selected" */
  resourcesCount: (n: number) => string;
};

export const veitApiKeysTexts: Record<'de' | 'en', VeitApiKeysTexts> = {
  de: {
    title: 'API-Keys',
    description: 'Mit einem Key greifen Geräte und Programme über die API auf dein Konto zu. Jeder Key bekommt nur die Rechte, die er braucht.',
    empty: 'Noch keine Keys.',
    create: 'Neuen Key anlegen',
    edit: 'Bearbeiten',
    save: 'Speichern',
    cancel: 'Abbrechen',
    revoke: 'Sperren',
    revokeTitle: 'Key sperren?',
    revokeConfirm: 'Geräte mit diesem Key verlieren sofort den Zugriff.',
    revoked: 'gesperrt',
    label: 'Bezeichnung',
    permissions: 'Berechtigungen',
    scope: 'Gilt für',
    scopeAll: 'Alle, auch künftige',
    scopeSome: 'Nur ausgewählte',
    scopeSomeHint: 'Was ein Key mit dieser Einstellung neu anlegt, kommt automatisch dazu.',
    noResources: 'Noch nichts vorhanden.',
    newKey: 'Dein neuer Key',
    newKeyHint: 'Bewahre ihn sicher auf.',
    notRevealable: 'Dieser Key wird nur beim Anlegen angezeigt. Wenn du ihn nicht mehr hast, lege einen neuen an und sperre diesen.',
    key: 'Key',
    show: 'Anzeigen',
    hide: 'Verbergen',
    copy: 'Kopieren',
    copied: 'Kopiert',
    close: 'Schließen',
    lastUsed: 'Zuletzt benutzt',
    never: 'nie',
    resourcesCount: (n) => `${n} ausgewählt`,
  },
  en: {
    title: 'API keys',
    description: 'With a key, devices and programs access your account over the API. Give each key only the rights it needs.',
    empty: 'No keys yet.',
    create: 'Create a key',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    revoke: 'Revoke',
    revokeTitle: 'Revoke the key?',
    revokeConfirm: 'Devices using it lose access at once.',
    revoked: 'revoked',
    label: 'Label',
    permissions: 'Permissions',
    scope: 'Applies to',
    scopeAll: 'All, including future ones',
    scopeSome: 'Selected only',
    scopeSomeHint: 'Whatever a key with this setting creates is added automatically.',
    noResources: 'Nothing yet.',
    newKey: 'Your new key',
    newKeyHint: 'Keep it safe.',
    notRevealable: 'This key is shown only when it is created. If you no longer have it, create a new one and revoke this one.',
    key: 'Key',
    show: 'Show',
    hide: 'Hide',
    copy: 'Copy',
    copied: 'Copied',
    close: 'Close',
    lastUsed: 'Last used',
    never: 'never',
    resourcesCount: (n) => `${n} selected`,
  },
};

export type VeitApiKeyPermission = { id: string; label: string; description?: string };
export type VeitApiKeyResource = { id: string; label: string };

type Draft = VeitApiKeyInput;

const emptyDraft = (permissions: VeitApiKeyPermission[]): Draft => ({
  label: '',
  permissions: permissions.map((p) => p.id),
  all_resources: true,
  resources: [],
});

const toDraft = (key: VeitApiKey): Draft => ({
  label: key.label,
  permissions: key.permissions,
  all_resources: key.all_resources,
  resources: key.resources,
});

const toInput = (draft: Draft): VeitApiKeyInput => ({
  ...draft,
  label: draft.label.trim(),
  resources: draft.all_resources ? [] : draft.resources,
});

function toggle(list: string[], id: string, on: boolean): string[] {
  return on ? [...new Set([...list, id])] : list.filter((x) => x !== id);
}

/**
 * The key itself, masked until shown, with a copy button. `known` is a key the client already has (just created);
 * otherwise `reveal` fetches it. Without either only the prefix is shown.
 */
function KeyField({
  apiKey,
  known,
  reveal,
  texts,
  errorText,
}: {
  apiKey: VeitApiKey;
  known?: string;
  reveal?: (id: string) => Promise<string>;
  texts: VeitApiKeysTexts;
  errorText: (error: unknown) => string;
}) {
  const [value, setValue] = useState<string | null>(known ?? null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const available = Boolean(known) || (Boolean(apiKey.revealable) && Boolean(reveal));
  const inputId = `api-key-${apiKey.id}`;

  const load = async (): Promise<string | null> => {
    if (value) return value;
    if (!reveal) return null;
    setLoading(true);
    setError(null);
    try {
      const key = await reveal(apiKey.id);
      setValue(key);
      return key;
    } catch (err) {
      setError(errorText(err));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const toggleVisible = async () => {
    if (visible) setVisible(false);
    else if (await load()) setVisible(true);
  };

  const copy = async () => {
    const key = await load();
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
    } catch (err) {
      setError(errorText(err));
    }
  };

  const toggleLabel = visible ? texts.hide : texts.show;
  return (
    <VeitField label={texts.key} htmlFor={inputId} hint={available ? undefined : texts.notRevealable} error={error ?? undefined}>
      <div className="flex min-w-0 gap-2">
        <VeitInput
          id={inputId}
          readOnly
          className="min-w-0 flex-1 font-mono"
          value={visible && value ? value : `${apiKey.prefix}…`}
          onFocus={(e) => e.currentTarget.select()}
        />
        {available && (
          <>
            <VeitButton
              variant="ghost"
              className={veitPasswordToggleButtonClass}
              aria-label={toggleLabel}
              title={toggleLabel}
              aria-pressed={visible}
              disabled={loading}
              onClick={() => void toggleVisible()}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : visible ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
            </VeitButton>
            <VeitButton variant="secondary" className="shrink-0" disabled={loading} onClick={() => void copy()}>
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? texts.copied : texts.copy}
            </VeitButton>
          </>
        )}
      </div>
    </VeitField>
  );
}

function KeyForm({
  draft,
  onChange,
  permissions,
  resources,
  resourceNoun,
  texts,
  disabled,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  permissions: VeitApiKeyPermission[];
  resources: VeitApiKeyResource[];
  resourceNoun: string;
  texts: VeitApiKeysTexts;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <VeitField label={texts.label} htmlFor="api-key-label">
        <VeitInput
          id="api-key-label"
          value={draft.label}
          maxLength={120}
          disabled={disabled}
          onChange={(e) => onChange({ ...draft, label: e.target.value })}
        />
      </VeitField>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="label">{texts.permissions}</legend>
        {permissions.map((p) => (
          <VeitSettingsToggleRow
            key={p.id}
            variant="embed"
            label={p.label}
            description={p.description}
            checked={draft.permissions.includes(p.id)}
            disabled={disabled}
            onCheckedChange={(on) => onChange({ ...draft, permissions: toggle(draft.permissions, p.id, on) })}
          />
        ))}
      </fieldset>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="label">
          {texts.scope} ({resourceNoun})
        </legend>
        <div className="flex flex-wrap gap-2">
          <VeitButton
            variant={draft.all_resources ? 'primary' : 'secondary'}
            aria-pressed={draft.all_resources}
            disabled={disabled}
            onClick={() => onChange({ ...draft, all_resources: true })}
          >
            {texts.scopeAll}
          </VeitButton>
          <VeitButton
            variant={draft.all_resources ? 'secondary' : 'primary'}
            aria-pressed={!draft.all_resources}
            disabled={disabled}
            onClick={() => onChange({ ...draft, all_resources: false })}
          >
            {texts.scopeSome}
          </VeitButton>
        </div>
        {!draft.all_resources && (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-xs text-muted-foreground">{texts.scopeSomeHint}</p>
            {resources.length === 0 && <p className="m-0 text-sm text-muted-foreground">{texts.noResources}</p>}
            {resources.map((r) => (
              <VeitSettingsToggleRow
                key={r.id}
                variant="embed"
                label={r.label}
                checked={draft.resources.includes(r.id)}
                disabled={disabled}
                onCheckedChange={(on) => onChange({ ...draft, resources: toggle(draft.resources, r.id, on) })}
              />
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}

type Editing = { mode: 'create' } | { mode: 'edit'; key: VeitApiKey };

type DialogProps = {
  client: VeitApiKeysClient;
  permissions: VeitApiKeyPermission[];
  resources: VeitApiKeyResource[];
  resourceNoun: string;
  texts: VeitApiKeysTexts;
  errorText: (error: unknown) => string;
};

/** Creates a key or shows and edits one; revoking sits in the footer. */
function KeyDialog({
  editing,
  onClose,
  onCreated,
  onChanged,
  client,
  permissions,
  resources,
  resourceNoun,
  texts,
  errorText,
}: DialogProps & {
  editing: Editing | null;
  onClose: () => void;
  onCreated: (key: string, apiKey: VeitApiKey) => void;
  onChanged: () => void;
}) {
  const open = editing !== null;
  const binding = useManagedOverlayDialogBinding(open, onClose);
  const current = editing?.mode === 'edit' ? editing.key : null;
  const initial = useMemo(() => (current ? toDraft(current) : emptyDraft(permissions)), [current, permissions]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initial);
      setError(null);
    }
  }, [open, initial]);

  const { dirty, formBaseline } = useDialogFormBaseline({ draft, resolveBaseline: () => initial, resetDeps: [open, initial], track: open });

  // Errors keep the dialog open: the footer only closes it after a resolved save or delete.
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorText(err));
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      if (current) {
        await client.update(current.id, toInput(draft));
        onChanged();
      } else {
        const { key, apiKey } = await client.create(toInput(draft));
        onCreated(key, apiKey);
      }
    });

  return (
    <VeitOverlayEditDialog
      binding={binding}
      title={current ? current.label : texts.create}
      closeAriaLabel={texts.close}
      variant="responsive"
      size="lg"
      disabled={busy}
      blockBackdropClose={busy}
      footerProps={{
        busy,
        dirty,
        formBaseline,
        saveRequiresDirty: current !== null,
        saveDisabled: !draft.label.trim() || draft.permissions.length === 0,
        cancelLabel: texts.cancel,
        saveLabel: current ? texts.save : texts.create,
        onSave: save,
        deleteAction: current
          ? {
              ariaLabel: texts.revoke,
              confirm: {
                title: texts.revokeTitle,
                message: texts.revokeConfirm,
                confirmLabel: texts.revoke,
                cancelLabel: texts.cancel,
                destructive: true,
              },
              onDelete: () =>
                run(async () => {
                  await client.revoke(current.id);
                  onChanged();
                }),
            }
          : undefined,
      }}
    >
      <div className="flex flex-col gap-4">
        {current && <KeyField key={current.id} apiKey={current} reveal={client.reveal} texts={texts} errorText={errorText} />}
        <KeyForm
          draft={draft}
          onChange={setDraft}
          permissions={permissions}
          resources={resources}
          resourceNoun={resourceNoun}
          texts={texts}
          disabled={busy}
        />
        {error && <p className="m-0 text-sm text-destructive">{error}</p>}
      </div>
    </VeitOverlayEditDialog>
  );
}

/** The key right after it was created. */
function CreatedKeyDialog({
  created,
  onClose,
  client,
  texts,
  errorText,
}: Pick<DialogProps, 'client' | 'texts' | 'errorText'> & {
  created: { key: string; apiKey: VeitApiKey } | null;
  onClose: () => void;
}) {
  const binding = useManagedOverlayDialogBinding(created !== null, onClose);
  return (
    <VeitOverlayDialog binding={binding} title={texts.newKey} closeAriaLabel={texts.close} variant="responsive" size="lg">
      {created && (
        <div className="flex flex-col gap-4">
          <p className="m-0 text-sm text-muted-foreground">
            {created.apiKey.revealable ? texts.newKeyHint : `${texts.notRevealable} ${texts.newKeyHint}`}
          </p>
          <KeyField key={created.apiKey.id} apiKey={created.apiKey} known={created.key} reveal={client.reveal} texts={texts} errorText={errorText} />
          <div className={VEIT_SETTINGS_ACTIONS}>
            <VeitButton onClick={onClose}>{texts.close}</VeitButton>
          </div>
        </div>
      )}
    </VeitOverlayDialog>
  );
}

/**
 * Lists the user's keys; a key opens in a popup to show, copy, edit and revoke it. permissions and resources come
 * from the host (e.g. its stations); resourceNoun names them in the scope ("Stationen").
 */
export function VeitApiKeysSection({
  client,
  permissions,
  resources,
  resourceNoun,
  texts,
  errorText,
  formatTime = (iso) => new Date(iso).toLocaleString(),
}: DialogProps & {
  formatTime?: (iso: string) => string;
}) {
  const [keys, setKeys] = useState<VeitApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [created, setCreated] = useState<{ key: string; apiKey: VeitApiKey } | null>(null);
  // Opened once the create dialog has closed: two overlays changing the history at once lose one of them.
  const pendingCreated = useRef<{ key: string; apiKey: VeitApiKey } | null>(null);

  const reload = useCallback(() => {
    client
      .list()
      .then((list) => {
        setKeys(list);
        setError(null);
      })
      .catch((err: unknown) => setError(errorText(err)));
  }, [client, errorText]);

  useEffect(reload, [reload]);

  const permissionLabel = (id: string) => permissions.find((p) => p.id === id)?.label ?? id;
  const resourceLabel = (id: string) => resources.find((r) => r.id === id)?.label ?? id;
  const scopeText = (key: VeitApiKey) =>
    key.all_resources
      ? texts.scopeAll
      : key.resources.length <= 3
        ? key.resources.map(resourceLabel).join(', ') || '—'
        : texts.resourcesCount(key.resources.length);

  return (
    <VeitAccountSection title={texts.title} description={texts.description}>
      <div className="flex flex-col gap-4">
        {keys === null && !error && <p className="m-0 text-sm text-muted-foreground">…</p>}
        {keys?.length === 0 && <p className="m-0 text-sm text-muted-foreground">{texts.empty}</p>}
        {keys && keys.length > 0 && (
          <VeitList className="flex flex-col gap-1">
            {keys.map((key) => (
              <VeitListItem
                key={key.id}
                className={key.revoked_at ? 'opacity-60' : undefined}
                title={
                  <>
                    <span className="truncate">{key.label}</span>
                    <code className="text-xs font-normal text-muted-foreground">{key.prefix}…</code>
                  </>
                }
                badge={key.revoked_at ? <VeitStatusBadge variant="neutral">{texts.revoked}</VeitStatusBadge> : undefined}
                meta={
                  <>
                    {key.permissions.map(permissionLabel).join(', ')} · {texts.scope}: {scopeText(key)} · {texts.lastUsed}:{' '}
                    {key.last_used_at ? formatTime(key.last_used_at) : texts.never}
                  </>
                }
                trailing={key.revoked_at ? undefined : <ChevronRight className="size-4 text-muted-foreground" aria-hidden />}
                onClick={key.revoked_at ? undefined : () => setEditing({ mode: 'edit', key })}
              />
            ))}
          </VeitList>
        )}

        {error && <p className="m-0 text-sm text-destructive">{error}</p>}

        <div className={VEIT_SETTINGS_ACTIONS}>
          <VeitButton onClick={() => setEditing({ mode: 'create' })}>{texts.create}</VeitButton>
        </div>
      </div>

      <KeyDialog
        editing={editing}
        onClose={() => {
          setEditing(null);
          if (pendingCreated.current) setCreated(pendingCreated.current);
          pendingCreated.current = null;
        }}
        onCreated={(key, apiKey) => {
          pendingCreated.current = { key, apiKey };
          reload();
        }}
        onChanged={reload}
        client={client}
        permissions={permissions}
        resources={resources}
        resourceNoun={resourceNoun}
        texts={texts}
        errorText={errorText}
      />
      <CreatedKeyDialog created={created} onClose={() => setCreated(null)} client={client} texts={texts} errorText={errorText} />
    </VeitAccountSection>
  );
}
