import React from 'react';
import { VeitPasswordField } from '@veit/react-controls';
import {
  VeitSettingsSection,
  VeitSettingsSubsection,
  VEIT_SETTINGS_ACTIONS,
} from '@veit/react-controls';
import type { AccountClient, AccountMfaStatus, AccountSession } from './types.js';

export function VeitAccountSection({
  title,
  children,
  description,
  icon,
  id,
  variant,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentProps<typeof VeitSettingsSection>['icon'];
  id?: string;
  variant?: React.ComponentProps<typeof VeitSettingsSection>['variant'];
}) {
  return (
    <VeitSettingsSection id={id} title={title} description={description} icon={icon} variant={variant}>
      {children}
    </VeitSettingsSection>
  );
}

export function VeitAccountPasswordSection({
  title,
  currentPasswordLabel,
  newPasswordLabel,
  currentPassword,
  newPassword,
  submitting,
  saveLabel,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onSubmit,
  showPasswordLabel,
  hidePasswordLabel,
}: {
  title: string;
  currentPasswordLabel: string;
  newPasswordLabel: string;
  currentPassword: string;
  newPassword: string;
  submitting: boolean;
  saveLabel: string;
  showPasswordLabel: string;
  hidePasswordLabel: string;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <VeitAccountSection title={title}>
      <form noValidate onSubmit={onSubmit} className="max-w-md space-y-3">
        <div>
          <label className="label">{currentPasswordLabel}</label>
          <VeitPasswordField
            showPasswordLabel={showPasswordLabel}
            hidePasswordLabel={hidePasswordLabel}
            value={currentPassword}
            onChange={(e) => onCurrentPasswordChange(e.target.value)}
            autoComplete="current-password"
            className="input"
          />
        </div>
        <div>
          <label className="label">{newPasswordLabel}</label>
          <VeitPasswordField
            showPasswordLabel={showPasswordLabel}
            hidePasswordLabel={hidePasswordLabel}
            value={newPassword}
            onChange={(e) => onNewPasswordChange(e.target.value)}
            autoComplete="new-password"
            className="input"
          />
        </div>
        {(currentPassword.length > 0 || newPassword.length > 0) && (
          <div className={VEIT_SETTINGS_ACTIONS}>
            <button type="submit" disabled={submitting} className="btn-primary btn-sm">
              {saveLabel}
            </button>
          </div>
        )}
      </form>
    </VeitAccountSection>
  );
}

export function VeitAccountProfileFields({
  firstName,
  lastName,
  firstNameLabel,
  lastNameLabel,
  disabled,
  onFirstNameChange,
  onLastNameChange,
  onNameBlur,
  avatarSlot,
}: {
  firstName: string;
  lastName: string;
  firstNameLabel: string;
  lastNameLabel: string;
  disabled?: boolean;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onNameBlur?: () => void;
  avatarSlot?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
      {avatarSlot ? <div className="flex justify-center sm:justify-start">{avatarSlot}</div> : null}
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <label htmlFor="veit-account-first-name" className="label">
            {firstNameLabel}
          </label>
          <input
            id="veit-account-first-name"
            type="text"
            value={firstName}
            onChange={(e) => onFirstNameChange(e.target.value)}
            onBlur={() => onNameBlur?.()}
            disabled={disabled}
            className="input"
            autoComplete="given-name"
          />
        </div>
        <div>
          <label htmlFor="veit-account-last-name" className="label">
            {lastNameLabel}
          </label>
          <input
            id="veit-account-last-name"
            type="text"
            value={lastName}
            onChange={(e) => onLastNameChange(e.target.value)}
            onBlur={() => onNameBlur?.()}
            disabled={disabled}
            className="input"
            autoComplete="family-name"
          />
        </div>
      </div>
    </div>
  );
}

export function VeitAccountEmailField({
  email,
  label,
  hint,
  disabled,
  onChange,
  onBlur,
}: {
  email: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <VeitAccountSection title={label} description={hint}>
      <input
        id="veit-account-email"
        type="email"
        value={email}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onBlur?.()}
        disabled={disabled}
        className="input max-w-md"
        autoComplete="email"
      />
    </VeitAccountSection>
  );
}

export function VeitAccountSessionsSection({
  title,
  loadingLabel,
  emptyLabel,
  revokeLabel,
  currentLabel,
  loading,
  error,
  sessions,
  onRevoke,
  busyId,
}: {
  title: string;
  loadingLabel: string;
  emptyLabel: string;
  revokeLabel: string;
  currentLabel: string;
  loading: boolean;
  error?: string | null;
  sessions: AccountSession[];
  onRevoke: (id: string | number) => void;
  busyId?: string | number | null;
}) {
  return (
    <VeitAccountSection title={title}>
      {loading ? <p className="muted">{loadingLabel}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!loading && !error && sessions.length === 0 ? <p className="muted">{emptyLabel}</p> : null}
      <ul className="space-y-2">
        {sessions.map((s) => (
          <li
            key={String(s.id)}
            className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">
                {s.summary}
                {s.isCurrent ? (
                  <span className="ml-2 text-xs text-muted-foreground">({currentLabel})</span>
                ) : null}
              </div>
              {s.detail ? <p className="mt-0.5 text-xs text-muted-foreground">{s.detail}</p> : null}
            </div>
            {!s.isCurrent ? (
              <button
                type="button"
                className="btn-secondary btn-sm shrink-0"
                disabled={busyId === s.id}
                onClick={() => onRevoke(s.id)}
              >
                {revokeLabel}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </VeitAccountSection>
  );
}

export function VeitAccountMfaSection({
  title,
  description,
  loading,
  loadingLabel,
  status,
  activeLabel,
  methodEmailLabel,
  methodTotpLabel,
  disablePasswordLabel,
  disableSubmitLabel,
  disablePassword,
  onDisablePasswordChange,
  onDisable,
  setupSlot,
  submitting,
}: {
  title: string;
  description?: string;
  loading: boolean;
  loadingLabel: string;
  status: AccountMfaStatus | null;
  activeLabel: string;
  methodEmailLabel: string;
  methodTotpLabel: string;
  disablePasswordLabel: string;
  disableSubmitLabel: string;
  disablePassword: string;
  onDisablePasswordChange: (value: string) => void;
  onDisable: (e: React.FormEvent) => void;
  setupSlot?: React.ReactNode;
  submitting?: boolean;
}) {
  return (
    <VeitAccountSection title={title} description={description}>
      {loading || !status ? (
        <p className="muted">{loadingLabel}</p>
      ) : status.mfaEnabled ? (
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            {activeLabel}{' '}
            <span className="font-medium">
              {status.mfaMethod === 'email' ? methodEmailLabel : methodTotpLabel}
            </span>
          </p>
          <form onSubmit={onDisable} className="max-w-md space-y-3">
            <div>
              <label className="label">{disablePasswordLabel}</label>
              <VeitPasswordField
                showPasswordLabel="Show"
                hidePasswordLabel="Hide"
                value={disablePassword}
                onChange={(e) => onDisablePasswordChange(e.target.value)}
                autoComplete="current-password"
                className="input"
              />
            </div>
            <div className={VEIT_SETTINGS_ACTIONS}>
              <button type="submit" disabled={submitting} className="btn-destructive btn-sm">
                {disableSubmitLabel}
              </button>
            </div>
          </form>
        </div>
      ) : (
        setupSlot ?? null
      )}
    </VeitAccountSection>
  );
}

export function VeitAccountDeletionSection({
  title,
  description,
  confirmLabel,
  onRequestDeletion,
  busy,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  onRequestDeletion: () => void;
  busy?: boolean;
}) {
  return (
    <VeitAccountSection title={title} description={description} variant="info">
      <VeitSettingsSubsection>
        <div className={VEIT_SETTINGS_ACTIONS}>
          <button type="button" className="btn-destructive btn-sm" disabled={busy} onClick={onRequestDeletion}>
            {confirmLabel}
          </button>
        </div>
      </VeitSettingsSubsection>
    </VeitAccountSection>
  );
}

/** Optional helper: change password via AccountClient. */
export async function veitAccountChangePassword(
  client: AccountClient,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await client.changePassword({ currentPassword, newPassword });
}
