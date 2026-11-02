import type { FormEvent, ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { VEIT_SETTINGS_ACTIONS_ROW, VeitButton, VeitInput } from '@veit/react-controls';

export type VeitTotpSetupPanelProps = {
  otpauthUri: string;
  secretBase32: string;
  scanHint: string;
  secretHintLabel: string;
  codeLabel: string;
  code: string;
  onCodeChange: (code: string) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  saveLabel: string;
  cancelLabel: string;
  submitting?: boolean;
  qrBgColor?: string;
  qrFgColor?: string;
  qrSize?: number;
};

export function VeitTotpSetupPanel({
  otpauthUri,
  secretBase32,
  scanHint,
  secretHintLabel,
  codeLabel,
  code,
  onCodeChange,
  onSubmit,
  onCancel,
  saveLabel,
  cancelLabel,
  submitting,
  qrBgColor = '#ffffff',
  qrFgColor = '#000000',
  qrSize = 180,
}: VeitTotpSetupPanelProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="muted">{scanHint}</p>
      <div className="flex justify-center">
        <QRCodeSVG
          className="block"
          value={otpauthUri}
          size={qrSize}
          level="M"
          marginSize={4}
          bgColor={qrBgColor}
          fgColor={qrFgColor}
        />
      </div>
      <p className="break-all font-mono text-xs text-muted-foreground">
        {secretHintLabel}: {secretBase32}
      </p>
      <div className="max-w-md">
        <label className="label">{codeLabel}</label>
        <VeitInput
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="font-mono tracking-widest"
        />
      </div>
      <div className={VEIT_SETTINGS_ACTIONS_ROW}>
        <VeitButton type="submit" disabled={submitting}>
          {saveLabel}
        </VeitButton>
        <VeitButton type="button" variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </VeitButton>
      </div>
    </form>
  );
}

export type VeitEmailMfaSetupPanelProps = {
  hint: string;
  codeLabel: string;
  code: string;
  onCodeChange: (code: string) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  saveLabel: string;
  cancelLabel: string;
  submitting?: boolean;
};

export function VeitEmailMfaSetupPanel({
  hint,
  codeLabel,
  code,
  onCodeChange,
  onSubmit,
  onCancel,
  saveLabel,
  cancelLabel,
  submitting,
}: VeitEmailMfaSetupPanelProps) {
  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <p className="muted">{hint}</p>
      <div>
        <label className="label">{codeLabel}</label>
        <VeitInput
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="font-mono tracking-widest"
        />
      </div>
      <div className={VEIT_SETTINGS_ACTIONS_ROW}>
        <VeitButton type="submit" disabled={submitting}>
          {saveLabel}
        </VeitButton>
        <VeitButton type="button" variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </VeitButton>
      </div>
    </form>
  );
}

export type VeitMfaSetupStartActionsProps = {
  totpLabel: string;
  emailLabel: string;
  onStartTotp: () => void;
  onStartEmail: () => void;
  disabled?: boolean;
  trailing?: ReactNode;
};

export function VeitMfaSetupStartActions({
  totpLabel,
  emailLabel,
  onStartTotp,
  onStartEmail,
  disabled,
  trailing,
}: VeitMfaSetupStartActionsProps) {
  return (
    <div className={VEIT_SETTINGS_ACTIONS_ROW}>
      <VeitButton type="button" disabled={disabled} onClick={onStartTotp}>
        {totpLabel}
      </VeitButton>
      <VeitButton type="button" variant="secondary" disabled={disabled} onClick={onStartEmail}>
        {emailLabel}
      </VeitButton>
      {trailing}
    </div>
  );
}
