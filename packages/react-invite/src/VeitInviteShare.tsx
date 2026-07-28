import React, { useState } from 'react';

export type VeitShareableLinkActionsProps = {
  label: string;
  url: string;
  copyAriaLabel?: string;
  qrAriaLabel?: string;
  /** Copy implementation — host provides clipboard helper. */
  onCopy: (url: string) => void | Promise<void>;
  /** QR data-URL generator — host provides (e.g. qrcode lib). Return null to skip QR. */
  toQrDataUrl?: (url: string, size: number) => Promise<string>;
  qrSize?: number;
  className?: string;
  renderIconButton: (props: {
    label: string;
    disabled?: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => React.ReactNode;
  copyIcon: React.ReactNode;
  qrIcon: React.ReactNode;
};

/**
 * Label + Copy + optional QR toggle — fertiges Share-Link-Modul.
 */
export function VeitShareableLinkActions({
  label,
  url,
  copyAriaLabel,
  qrAriaLabel,
  onCopy,
  toQrDataUrl,
  qrSize = 256,
  className = '',
  renderIconButton,
  copyIcon,
  qrIcon,
}: VeitShareableLinkActionsProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleQr = async () => {
    if (!toQrDataUrl) return;
    if (qrDataUrl) {
      setQrDataUrl(null);
      return;
    }
    setBusy(true);
    try {
      setQrDataUrl(await toQrDataUrl(url, qrSize));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className || 'veit-share-link'}>
      <div className="veit-share-link__row flex items-center justify-between gap-2">
        <div className="veit-share-link__label min-w-0 flex-1 text-sm font-medium">{label}</div>
        <div className="veit-share-link__actions flex shrink-0 items-center gap-1">
          {renderIconButton({
            label: copyAriaLabel ?? `Copy ${label}`,
            disabled: busy,
            onClick: () => void onCopy(url),
            children: copyIcon,
          })}
          {toQrDataUrl
            ? renderIconButton({
                label: qrAriaLabel ?? `Show ${label} QR`,
                disabled: busy,
                onClick: () => void toggleQr(),
                children: qrIcon,
              })
            : null}
        </div>
      </div>
      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt={`QR ${label}`}
          width={qrSize}
          height={qrSize}
          className="veit-share-link__qr mt-2"
        />
      ) : null}
    </div>
  );
}

export type VeitInviteListItem = {
  id: string;
  label: string;
  tokenOrUrl: string;
  createdAtLabel?: string;
  expiresAtLabel?: string;
};

export type VeitInviteListProps = {
  title: string;
  emptyLabel: string;
  createLabel: string;
  revokeLabel: string;
  copyLabel: string;
  items: VeitInviteListItem[];
  busy?: boolean;
  onCreate: () => void | Promise<void>;
  onRevoke: (id: string) => void | Promise<void>;
  onCopy: (tokenOrUrl: string) => void | Promise<void>;
};

/**
 * Invite-Erstellung/-Liste/-Revoke — generisch, ohne Org-oRPC.
 */
export function VeitInviteList({
  title,
  emptyLabel,
  createLabel,
  revokeLabel,
  copyLabel,
  items,
  busy,
  onCreate,
  onRevoke,
  onCopy,
}: VeitInviteListProps) {
  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="heading-2 m-0">{title}</h2>
        <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={() => void onCreate()}>
          {createLabel}
        </button>
      </div>
      {items.length === 0 ? <p className="muted text-sm">{emptyLabel}</p> : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium">{item.label}</div>
              {item.createdAtLabel || item.expiresAtLabel ? (
                <p className="text-xs text-muted-foreground">
                  {[item.createdAtLabel, item.expiresAtLabel].filter(Boolean).join(' · ')}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={busy}
                onClick={() => void onCopy(item.tokenOrUrl)}
              >
                {copyLabel}
              </button>
              <button
                type="button"
                className="btn-destructive btn-sm"
                disabled={busy}
                onClick={() => void onRevoke(item.id)}
              >
                {revokeLabel}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
