import React from 'react';
import { VeitPasswordField } from '@veit/react-controls';

export function VeitAccountSection({
  title,
  children,
  description,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <section className="card">
      <h2 className="heading-2 mb-2">{title}</h2>
      {description && <p className="muted mb-4">{description}</p>}
      {children}
    </section>
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
      <form noValidate onSubmit={onSubmit} className="space-y-3">
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
          <button type="submit" disabled={submitting} className="btn-primary">{saveLabel}</button>
        )}
      </form>
    </VeitAccountSection>
  );
}
