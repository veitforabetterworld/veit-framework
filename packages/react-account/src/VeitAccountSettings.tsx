import React, { useCallback, useEffect, useState, type FormEvent } from 'react';
import { VEIT_SETTINGS_ACTIONS } from '@veit/react-controls';
import { VeitEmailMfaSetupPanel, VeitMfaSetupStartActions, VeitTotpSetupPanel } from './mfaSetup.js';
import {
  VeitAccountDeletionSection,
  VeitAccountEmailField,
  VeitAccountMfaSection,
  VeitAccountPasswordSection,
  VeitAccountProfileFields,
  VeitAccountSection,
  VeitAccountSessionsSection,
} from './sections.js';
import type { VeitAccountTexts } from './texts.js';
import type { AccountClient, AccountMfaStatus, AccountSession } from './types.js';

export type VeitAccountSettingsUser = {
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
};

/**
 * The whole account page: profile (with e-mail confirmation), password, two-factor sign-in, sessions and deletion.
 * Host sections (API keys, own data …) go into children, between profile and security.
 */
export function VeitAccountSettings({
  client,
  user,
  texts,
  errorText,
  onUserChanged,
  onDeleted,
  resendVerification,
  children,
}: {
  client: AccountClient;
  user: VeitAccountSettingsUser;
  texts: VeitAccountTexts;
  /** Text for an error thrown by the client. */
  errorText: (error: unknown) => string;
  /** After profile or e-mail changes, so the host reloads its user. */
  onUserChanged: () => void | Promise<void>;
  onDeleted: () => void;
  resendVerification?: () => Promise<void>;
  children?: React.ReactNode;
}) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileNote, setProfileNote] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNote, setPasswordNote] = useState<{ ok: boolean; text: string } | null>(null);

  const [mfa, setMfa] = useState<AccountMfaStatus | null>(null);
  const [mfaSetup, setMfaSetup] = useState<{ kind: 'totp'; otpauthUri: string; secretBase32: string } | { kind: 'email' } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaDisablePassword, setMfaDisablePassword] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEmail(user.email);
  }, [user.firstName, user.lastName, user.email]);

  const loadSessions = useCallback(() => {
    setSessionsLoading(true);
    client
      .listSessions()
      .then((list) => {
        setSessions(list);
        setSessionsError(null);
      })
      .catch((err: unknown) => setSessionsError(errorText(err)))
      .finally(() => setSessionsLoading(false));
  }, [client, errorText]);

  const loadMfa = useCallback(() => {
    client
      .getMfaStatus()
      .then(setMfa)
      .catch((err: unknown) => setMfaError(errorText(err)));
  }, [client, errorText]);

  useEffect(() => {
    loadSessions();
    loadMfa();
  }, [loadSessions, loadMfa]);

  const profileDirty = firstName !== user.firstName || lastName !== user.lastName || email.trim() !== user.email;

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setProfileBusy(true);
    setProfileNote(null);
    try {
      await client.patchProfile({ firstName, lastName, email: email.trim() !== user.email ? email.trim() : undefined });
      await onUserChanged();
      setProfileNote({ ok: true, text: texts.profileSaved });
    } catch (err) {
      setProfileNote({ ok: false, text: errorText(err) });
    } finally {
      setProfileBusy(false);
    }
  }

  async function resend() {
    if (!resendVerification) return;
    try {
      await resendVerification();
      setProfileNote({ ok: true, text: texts.verificationSent });
    } catch (err) {
      setProfileNote({ ok: false, text: errorText(err) });
    }
  }

  async function savePassword(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordBusy(true);
    setPasswordNote(null);
    try {
      await client.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordNote({ ok: true, text: texts.passwordSaved });
      loadSessions();
    } catch (err) {
      setPasswordNote({ ok: false, text: errorText(err) });
    } finally {
      setPasswordBusy(false);
    }
  }

  async function runMfa(action: () => Promise<void>) {
    setMfaBusy(true);
    setMfaError(null);
    try {
      await action();
    } catch (err) {
      setMfaError(errorText(err));
    } finally {
      setMfaBusy(false);
    }
  }

  const startTotp = () =>
    runMfa(async () => {
      const setup = await client.startTotpMfa!();
      setMfaCode('');
      setMfaSetup({ kind: 'totp', ...setup });
    });

  const startEmail = () =>
    runMfa(async () => {
      await client.startEmailMfa!();
      setMfaCode('');
      setMfaSetup({ kind: 'email' });
    });

  const confirmSetup = (event: FormEvent) => {
    event.preventDefault();
    void runMfa(async () => {
      if (mfaSetup?.kind === 'totp') await client.confirmTotpMfa!(mfaCode);
      else await client.confirmEmailMfa!(mfaCode);
      setMfaSetup(null);
      setMfa(await client.getMfaStatus());
    });
  };

  const disableMfa = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runMfa(async () => {
      await client.disableMfa!(mfaDisablePassword);
      setMfaDisablePassword('');
      setMfa(await client.getMfaStatus());
    });
  };

  async function revoke(id: string | number) {
    setRevoking(id);
    try {
      await client.revokeSession(id);
      loadSessions();
    } catch (err) {
      setSessionsError(errorText(err));
    } finally {
      setRevoking(null);
    }
  }

  async function deleteAccount() {
    if (!client.requestDeletion || !window.confirm(texts.deleteConfirm)) return;
    setDeleting(true);
    try {
      await client.requestDeletion();
      onDeleted();
    } catch (err) {
      window.alert(errorText(err));
      setDeleting(false);
    }
  }

  const setupSlot =
    mfaSetup?.kind === 'totp' ? (
      <VeitTotpSetupPanel
        otpauthUri={mfaSetup.otpauthUri}
        secretBase32={mfaSetup.secretBase32}
        scanHint={texts.mfaScanHint}
        secretHintLabel={texts.mfaSecret}
        codeLabel={texts.mfaCode}
        code={mfaCode}
        onCodeChange={setMfaCode}
        onSubmit={confirmSetup}
        onCancel={() => setMfaSetup(null)}
        saveLabel={texts.mfaConfirm}
        cancelLabel={texts.mfaCancel}
        submitting={mfaBusy}
      />
    ) : mfaSetup?.kind === 'email' ? (
      <VeitEmailMfaSetupPanel
        hint={texts.mfaEmailHint}
        codeLabel={texts.mfaCode}
        code={mfaCode}
        onCodeChange={setMfaCode}
        onSubmit={confirmSetup}
        onCancel={() => setMfaSetup(null)}
        saveLabel={texts.mfaConfirm}
        cancelLabel={texts.mfaCancel}
        submitting={mfaBusy}
      />
    ) : (
      <VeitMfaSetupStartActions
        totpLabel={texts.mfaStartTotp}
        emailLabel={texts.mfaStartEmail}
        onStartTotp={() => void startTotp()}
        onStartEmail={() => void startEmail()}
        disabled={mfaBusy || !client.startTotpMfa}
      />
    );

  return (
    <div className="flex flex-col gap-6">
      <VeitAccountSection title={texts.profileTitle}>
        <form className="max-w-md space-y-3" onSubmit={saveProfile} noValidate>
          <VeitAccountProfileFields
            firstName={firstName}
            lastName={lastName}
            firstNameLabel={texts.firstName}
            lastNameLabel={texts.lastName}
            onFirstNameChange={setFirstName}
            onLastNameChange={setLastName}
          />
          <VeitAccountEmailField email={email} label={texts.email} hint={texts.emailChangeHint} onChange={setEmail} />
          {!user.emailVerified && (
            <p className="text-sm text-muted-foreground">
              {texts.unverified}{' '}
              {resendVerification && (
                <button type="button" className="btn-secondary btn-sm" onClick={() => void resend()}>
                  {texts.resendVerification}
                </button>
              )}
            </p>
          )}
          {profileNote && <p className={`text-sm ${profileNote.ok ? 'text-muted-foreground' : 'text-destructive'}`}>{profileNote.text}</p>}
          {profileDirty && (
            <div className={VEIT_SETTINGS_ACTIONS}>
              <button type="submit" className="btn-primary btn-sm" disabled={profileBusy}>
                {texts.saveProfile}
              </button>
            </div>
          )}
        </form>
      </VeitAccountSection>

      {children}

      <VeitAccountPasswordSection
        title={texts.passwordTitle}
        currentPasswordLabel={texts.currentPassword}
        newPasswordLabel={texts.newPassword}
        currentPassword={currentPassword}
        newPassword={newPassword}
        submitting={passwordBusy}
        saveLabel={texts.savePassword}
        showPasswordLabel={texts.showPassword}
        hidePasswordLabel={texts.hidePassword}
        onCurrentPasswordChange={setCurrentPassword}
        onNewPasswordChange={setNewPassword}
        onSubmit={savePassword}
      />
      {passwordNote && <p className={`-mt-4 text-sm ${passwordNote.ok ? 'text-muted-foreground' : 'text-destructive'}`}>{passwordNote.text}</p>}

      <VeitAccountMfaSection
        title={texts.mfaTitle}
        description={texts.mfaDescription}
        loading={mfa === null}
        loadingLabel={texts.loading}
        status={mfa}
        activeLabel={texts.mfaActive}
        methodEmailLabel={texts.mfaMethodEmail}
        methodTotpLabel={texts.mfaMethodTotp}
        disablePasswordLabel={texts.mfaDisablePassword}
        disableSubmitLabel={texts.mfaDisable}
        disablePassword={mfaDisablePassword}
        onDisablePasswordChange={setMfaDisablePassword}
        onDisable={disableMfa}
        setupSlot={setupSlot}
        submitting={mfaBusy}
        showPasswordLabel={texts.showPassword}
        hidePasswordLabel={texts.hidePassword}
      />
      {mfaError && <p className="-mt-4 text-sm text-destructive">{mfaError}</p>}

      <VeitAccountSessionsSection
        title={texts.sessionsTitle}
        loadingLabel={texts.loading}
        emptyLabel={texts.sessionsEmpty}
        revokeLabel={texts.sessionRevoke}
        currentLabel={texts.sessionCurrent}
        loading={sessionsLoading}
        error={sessionsError}
        sessions={sessions}
        onRevoke={(id) => void revoke(id)}
        busyId={revoking}
      />

      {client.requestDeletion && (
        <VeitAccountDeletionSection
          title={texts.deleteTitle}
          description={texts.deleteDescription}
          confirmLabel={texts.deleteButton}
          onRequestDeletion={() => void deleteAccount()}
          busy={deleting}
        />
      )}
    </div>
  );
}
