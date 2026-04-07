import React from 'react';

export type InviteTokenViewModel = {
  organizationName: string;
  invitedEmail: string;
};

export function InviteTokenView({
  t,
  invite,
  loading,
  acceptError,
  userPresent,
  actionBusy,
  onAccept,
  onDecline,
  renderLogo,
  renderSkipToMain,
}: {
  t: (key: string) => string;
  invite: InviteTokenViewModel | null;
  loading: boolean;
  acceptError: boolean;
  userPresent: boolean;
  actionBusy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  renderLogo?: () => React.ReactNode;
  renderSkipToMain?: () => React.ReactNode;
}) {
  if (loading) return <div className="max-w-md mx-auto mt-12 muted">{t('common.loading')}</div>;
  if (!invite) return <div className="max-w-md mx-auto mt-12 text-destructive">{t('invite.not_found')}</div>;

  const orgName = invite.organizationName;
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {renderSkipToMain?.()}
      <main id="main-content" tabIndex={-1} className="outline-none rounded-sm w-full max-w-md">
        <div className="flex justify-center mb-6 text-foreground">{renderLogo?.()}</div>
        <div className="card">
          <h1 className="text-xl font-semibold text-foreground">{t('invite.invite')}</h1>
          <p className="muted mb-4">{orgName}</p>
          <p className="text-foreground mb-4">{t('invite.pending_body').replace(/\{\{name\}\}/g, orgName)}</p>
          {!userPresent && <p className="muted mb-4">{t('invite.login_to_accept')}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onAccept} disabled={actionBusy} className="btn-primary">{t('invite.accept')}</button>
            <button type="button" onClick={onDecline} disabled={actionBusy} className="btn-secondary">{t('invite.decline')}</button>
          </div>
          {acceptError && <p className="text-destructive mt-3">{t('invite.accept_error')}</p>}
        </div>
      </main>
    </div>
  );
}
