import React, { useCallback, useEffect, useState, type FormEvent } from 'react';
import { VeitAccountSection } from '@veit/react-account';
import { VEIT_SETTINGS_ACTIONS, VeitSettingsToggleRow, VeitStatusBadge } from '@veit/react-controls';

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
  copy: string;
  copied: string;
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
    revokeConfirm: 'Key sperren? Geräte mit diesem Key verlieren sofort den Zugriff.',
    revoked: 'gesperrt',
    label: 'Bezeichnung',
    permissions: 'Berechtigungen',
    scope: 'Gilt für',
    scopeAll: 'Alle, auch künftige',
    scopeSome: 'Nur ausgewählte',
    scopeSomeHint: 'Was ein Key mit dieser Einstellung neu anlegt, kommt automatisch dazu.',
    noResources: 'Noch nichts vorhanden.',
    newKey: 'Dein neuer Key',
    newKeyHint: 'Er wird nur jetzt angezeigt. Bewahre ihn sicher auf.',
    copy: 'Kopieren',
    copied: 'Kopiert',
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
    revokeConfirm: 'Revoke the key? Devices using it lose access at once.',
    revoked: 'revoked',
    label: 'Label',
    permissions: 'Permissions',
    scope: 'Applies to',
    scopeAll: 'All, including future ones',
    scopeSome: 'Selected only',
    scopeSomeHint: 'Whatever a key with this setting creates is added automatically.',
    noResources: 'Nothing yet.',
    newKey: 'Your new key',
    newKeyHint: 'It is shown only now. Keep it safe.',
    copy: 'Copy',
    copied: 'Copied',
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

function toggle(list: string[], id: string, on: boolean): string[] {
  return on ? [...new Set([...list, id])] : list.filter((x) => x !== id);
}

function KeyForm({
  draft,
  onChange,
  permissions,
  resources,
  resourceNoun,
  texts,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  permissions: VeitApiKeyPermission[];
  resources: VeitApiKeyResource[];
  resourceNoun: string;
  texts: VeitApiKeysTexts;
  busy: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form className="max-w-xl space-y-4" onSubmit={submit} noValidate>
      <div>
        <label className="label">{texts.label}</label>
        <input className="input" value={draft.label} maxLength={120} onChange={(e) => onChange({ ...draft, label: e.target.value })} />
      </div>
      <fieldset className="space-y-2">
        <legend className="label">{texts.permissions}</legend>
        {permissions.map((p) => (
          <VeitSettingsToggleRow
            key={p.id}
            variant="embed"
            label={p.label}
            description={p.description}
            checked={draft.permissions.includes(p.id)}
            onCheckedChange={(on) => onChange({ ...draft, permissions: toggle(draft.permissions, p.id, on) })}
          />
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="label">
          {texts.scope} ({resourceNoun})
        </legend>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={draft.all_resources ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
            aria-pressed={draft.all_resources}
            onClick={() => onChange({ ...draft, all_resources: true })}
          >
            {texts.scopeAll}
          </button>
          <button
            type="button"
            className={!draft.all_resources ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
            aria-pressed={!draft.all_resources}
            onClick={() => onChange({ ...draft, all_resources: false })}
          >
            {texts.scopeSome}
          </button>
        </div>
        {!draft.all_resources && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{texts.scopeSomeHint}</p>
            {resources.length === 0 && <p className="text-sm text-muted-foreground">{texts.noResources}</p>}
            {resources.map((r) => (
              <VeitSettingsToggleRow
                key={r.id}
                variant="embed"
                label={r.label}
                checked={draft.resources.includes(r.id)}
                onCheckedChange={(on) => onChange({ ...draft, resources: toggle(draft.resources, r.id, on) })}
              />
            ))}
          </div>
        )}
      </fieldset>
      <div className={VEIT_SETTINGS_ACTIONS}>
        {onCancel && (
          <button type="button" className="btn-secondary btn-sm" onClick={onCancel}>
            {texts.cancel}
          </button>
        )}
        <button type="submit" className="btn-primary btn-sm" disabled={busy || !draft.label.trim() || draft.permissions.length === 0}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

/**
 * Lists the user's keys and creates, edits and revokes them. permissions and resources come from the host
 * (e.g. its stations); resourceNoun names them in the scope ("Stationen").
 */
export function VeitApiKeysSection({
  client,
  permissions,
  resources,
  resourceNoun,
  texts,
  errorText,
  formatTime = (iso) => new Date(iso).toLocaleString(),
}: {
  client: VeitApiKeysClient;
  permissions: VeitApiKeyPermission[];
  resources: VeitApiKeyResource[];
  resourceNoun: string;
  texts: VeitApiKeysTexts;
  errorText: (error: unknown) => string;
  formatTime?: (iso: string) => string;
}) {
  const [keys, setKeys] = useState<VeitApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(permissions));
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<{ id: string; draft: Draft } | null>(null);
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    void run(async () => {
      const { key } = await client.create({ ...draft, label: draft.label.trim(), resources: draft.all_resources ? [] : draft.resources });
      setNewKey(key);
      setCopied(false);
      setCreating(false);
      setDraft(emptyDraft(permissions));
      reload();
    });

  const save = () =>
    void run(async () => {
      if (!editing) return;
      await client.update(editing.id, {
        ...editing.draft,
        label: editing.draft.label.trim(),
        resources: editing.draft.all_resources ? [] : editing.draft.resources,
      });
      setEditing(null);
      reload();
    });

  const revoke = (key: VeitApiKey) => {
    if (!window.confirm(texts.revokeConfirm)) return;
    void run(async () => {
      await client.revoke(key.id);
      reload();
    });
  };

  const permissionLabel = (id: string) => permissions.find((p) => p.id === id)?.label ?? id;
  const resourceLabel = (id: string) => resources.find((r) => r.id === id)?.label ?? id;

  return (
    <VeitAccountSection title={texts.title} description={texts.description}>
      <div className="space-y-4">
        {newKey && (
          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            <p className="text-sm font-medium text-foreground">{texts.newKey}</p>
            <p className="text-xs text-muted-foreground">{texts.newKeyHint}</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded bg-muted px-2 py-1.5 text-xs">{newKey}</code>
              <button
                type="button"
                className="btn-secondary btn-sm shrink-0"
                onClick={() => void navigator.clipboard.writeText(newKey).then(() => setCopied(true))}
              >
                {copied ? texts.copied : texts.copy}
              </button>
            </div>
          </div>
        )}

        {keys === null && !error && <p className="muted">…</p>}
        {keys?.length === 0 && <p className="muted">{texts.empty}</p>}
        <ul className="space-y-2">
          {keys?.map((key) =>
            editing?.id === key.id ? (
              <li key={key.id} className="rounded-lg border border-border/60 p-3">
                <KeyForm
                  draft={editing.draft}
                  onChange={(next) => setEditing({ id: key.id, draft: next })}
                  permissions={permissions}
                  resources={resources}
                  resourceNoun={resourceNoun}
                  texts={texts}
                  busy={busy}
                  submitLabel={texts.save}
                  onSubmit={save}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={key.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    <span className="truncate">{key.label}</span>
                    <code className="text-xs text-muted-foreground">{key.prefix}…</code>
                    {key.revoked_at && <VeitStatusBadge variant="neutral">{texts.revoked}</VeitStatusBadge>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {key.permissions.map((p) => (
                      <VeitStatusBadge key={p} variant="neutral">
                        {permissionLabel(p)}
                      </VeitStatusBadge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {texts.scope}:{' '}
                    {key.all_resources
                      ? texts.scopeAll
                      : key.resources.length <= 3
                        ? key.resources.map(resourceLabel).join(', ') || '—'
                        : texts.resourcesCount(key.resources.length)}
                    {' · '}
                    {texts.lastUsed}: {key.last_used_at ? formatTime(key.last_used_at) : texts.never}
                  </p>
                </div>
                {!key.revoked_at && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() =>
                        setEditing({
                          id: key.id,
                          draft: { label: key.label, permissions: key.permissions, all_resources: key.all_resources, resources: key.resources },
                        })
                      }
                    >
                      {texts.edit}
                    </button>
                    <button type="button" className="btn-destructive btn-sm" disabled={busy} onClick={() => revoke(key)}>
                      {texts.revoke}
                    </button>
                  </div>
                )}
              </li>
            ),
          )}
        </ul>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {creating ? (
          <div className="rounded-lg border border-border/60 p-3">
            <KeyForm
              draft={draft}
              onChange={setDraft}
              permissions={permissions}
              resources={resources}
              resourceNoun={resourceNoun}
              texts={texts}
              busy={busy}
              submitLabel={texts.create}
              onSubmit={create}
              onCancel={() => setCreating(false)}
            />
          </div>
        ) : (
          <div className={VEIT_SETTINGS_ACTIONS}>
            <button type="button" className="btn-primary btn-sm" onClick={() => setCreating(true)}>
              {texts.create}
            </button>
          </div>
        )}
      </div>
    </VeitAccountSection>
  );
}
