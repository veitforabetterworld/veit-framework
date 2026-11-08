import React, { useRef, useState } from 'react';
import { AppWindow, Globe, HelpCircle, Monitor, Smartphone, TabletSmartphone } from 'lucide-react';
import { VeitAlert, VeitButton, VeitStatusBadge, VeitSettingsSection } from '@veit/react-controls';
import { VeitConfirmDialog, type VeitDeleteConfirmConfig } from '@veit/react-dialog';
import type { VeitBrowserKind, VeitClientKind } from '@veit/intl';
import { VEIT_BROWSER_BRAND_ICONS } from './browserBrandIcons.js';
import type { AccountSession } from './types.js';

const CLIENT_ICONS: Record<VeitClientKind, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  browser: Globe,
  app: AppWindow,
  android: Smartphone,
  ios: TabletSmartphone,
  desktop: Monitor,
  unknown: HelpCircle,
};

const TILE = 'inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg';

export type VeitSessionClientIconProps = {
  kind: VeitClientKind;
  /** With kind `browser`: its logo in the brand colour; unknown browsers get a globe. */
  browser?: VeitBrowserKind;
  /** With kind `app`: the host's app icon (e.g. '/apple-touch-icon.png' from @veit/app-icons), else a neutral icon. */
  appIconSrc?: string;
  className?: string;
};

/**
 * Icon of a session or device row: browser logo, the host's app icon or a neutral icon by client kind. Decorative
 * (the row text names the device). Browser logos sit on a white tile, as brand logos are made for white; the same
 * tile in dark mode keeps them recognisable.
 */
export function VeitSessionClientIcon({ kind, browser, appIconSrc, className = '' }: VeitSessionClientIconProps) {
  if (kind === 'app' && appIconSrc) {
    return (
      <span className={`${TILE} ring-1 ring-border ${className}`.trim()} aria-hidden>
        <img src={appIconSrc} alt="" className="size-full object-cover" />
      </span>
    );
  }
  const brand = kind === 'browser' && browser ? VEIT_BROWSER_BRAND_ICONS[browser] : undefined;
  if (brand) {
    return (
      <span className={`${TILE} bg-white ring-1 ring-border ${className}`.trim()} aria-hidden>
        <svg
          viewBox={brand.viewBox}
          className="size-5"
          fill={brand.stroke ? 'none' : brand.color}
          stroke={brand.stroke ? brand.color : undefined}
          strokeWidth={brand.stroke ? 2 : undefined}
          strokeLinecap={brand.stroke ? 'round' : undefined}
          strokeLinejoin={brand.stroke ? 'round' : undefined}
          aria-hidden
        >
          {brand.paths.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
      </span>
    );
  }
  const Icon = CLIENT_ICONS[kind] ?? HelpCircle;
  return (
    <span className={`${TILE} bg-muted text-muted-foreground ${className}`.trim()} aria-hidden>
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

export type VeitAccountSessionsSectionProps = {
  /** Section title; in `embedded` mode a small heading above the list ('' hides it). */
  title: string;
  loadingLabel: string;
  emptyLabel: string;
  revokeLabel: string;
  currentLabel: string;
  loading: boolean;
  error?: string | null;
  sessions: AccountSession[];
  /** May return a promise; with `confirmRemove` the dialog waits for it. */
  onRevoke: (id: string | number) => void | Promise<void>;
  busyId?: string | number | null;
  /** Asks in a VeitConfirmDialog before onRevoke (e.g. "„Firefox · Windows“ abmelden?"). */
  confirmRemove?: VeitDeleteConfirmConfig | ((session: AccountSession) => VeitDeleteConfirmConfig);
  /** Only the list, without the section card, e.g. inside a dialog or another section. */
  embedded?: boolean;
  /** The host's app icon for sessions of its own app (clientKind `app`), e.g. '/apple-touch-icon.png'. */
  appIconSrc?: string;
  /** Overrides the icon by `clientKind`; null hides it. */
  renderClientIcon?: (session: AccountSession) => React.ReactNode;
};

/**
 * Signed-in sessions or devices with an icon by client kind, badges ("Push aktiv"), "this device" and a sign-out
 * button for the others. Rows without `clientKind` and without renderClientIcon have no icon, as before.
 */
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
  confirmRemove,
  embedded = false,
  appIconSrc,
  renderClientIcon,
}: VeitAccountSessionsSectionProps) {
  const [confirming, setConfirming] = useState<AccountSession | null>(null);
  // The dialog closes before it calls onConfirm; the ref keeps the session for it.
  const pending = useRef<AccountSession | null>(null);
  const confirmConfig = confirming && confirmRemove ? (typeof confirmRemove === 'function' ? confirmRemove(confirming) : confirmRemove) : null;

  const icon = (s: AccountSession): React.ReactNode => {
    if (renderClientIcon) return renderClientIcon(s);
    return s.clientKind ? <VeitSessionClientIcon kind={s.clientKind} browser={s.browser} appIconSrc={appIconSrc} /> : null;
  };

  const content = (
    <>
      {loading ? <p className="m-0 text-sm text-muted-foreground">{loadingLabel}</p> : null}
      {error ? <VeitAlert variant="error">{error}</VeitAlert> : null}
      {!loading && !error && sessions.length === 0 ? <p className="m-0 text-sm text-muted-foreground">{emptyLabel}</p> : null}
      {sessions.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {sessions.map((s) => {
            const leading = icon(s);
            return (
              <li key={String(s.id)} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
                <div className="flex min-w-0 items-start gap-3">
                  {leading}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-foreground">
                      <span className="min-w-0 break-words">{s.summary}</span>
                      {s.isCurrent ? <span className="text-xs font-normal text-muted-foreground">({currentLabel})</span> : null}
                      {s.badges?.map((badge, i) => (
                        <VeitStatusBadge key={i} variant={badge.variant ?? 'primary'} size="md" icon={badge.icon}>
                          {badge.label}
                        </VeitStatusBadge>
                      ))}
                    </div>
                    {s.detail ? <p className="m-0 mt-0.5 text-xs text-muted-foreground">{s.detail}</p> : null}
                  </div>
                </div>
                {!s.isCurrent ? (
                  <VeitButton
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    disabled={busyId === s.id}
                    onClick={() => {
                      if (!confirmRemove) {
                        void onRevoke(s.id);
                        return;
                      }
                      pending.current = s;
                      setConfirming(s);
                    }}
                  >
                    {revokeLabel}
                  </VeitButton>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {confirmRemove ? (
        <VeitConfirmDialog
          open={confirmConfig !== null}
          onClose={() => setConfirming(null)}
          title={confirmConfig?.title ?? ''}
          message={confirmConfig?.message ?? ''}
          confirmLabel={confirmConfig?.confirmLabel ?? revokeLabel}
          cancelLabel={confirmConfig?.cancelLabel ?? ''}
          destructive={confirmConfig?.destructive ?? true}
          closeAriaLabel={confirmConfig?.closeAriaLabel}
          backdropDismissLabel={confirmConfig?.backdropDismissLabel}
          disabled={confirmConfig?.disabled}
          blockBackdropClose={confirmConfig?.blockBackdropClose}
          onConfirm={async () => {
            const session = pending.current;
            pending.current = null;
            if (session) await onRevoke(session.id);
          }}
        />
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <div className="flex flex-col gap-2">
        {title ? <p className="m-0 text-sm font-semibold text-muted-foreground">{title}</p> : null}
        {content}
      </div>
    );
  }
  return (
    <VeitSettingsSection title={title}>
      <div className="flex flex-col gap-2">{content}</div>
    </VeitSettingsSection>
  );
}
