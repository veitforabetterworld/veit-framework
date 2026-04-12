import type { ReactNode } from 'react';
import { VeitThumbnailImageLightbox } from '@veit/react-upload';

import { veitPersonAvatarInitial } from './personDisplay.js';

const THUMB: Record<'sm' | 'md', string> = {
  sm: 'flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xs font-medium text-muted-foreground',
  md: 'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-sm font-medium text-muted-foreground',
};

export function VeitPersonAvatarThumb({
  src,
  initial,
  size = 'md',
  className = '',
  alt = '',
  previewAriaLabel,
  closeAriaLabel,
}: {
  src: string | null;
  initial: string;
  size?: 'sm' | 'md';
  className?: string;
  alt?: string;
  previewAriaLabel: string;
  closeAriaLabel: string;
}) {
  return (
    <VeitThumbnailImageLightbox
      src={src}
      alt={alt}
      mode="view"
      className={className}
      thumbnailClassName={THUMB[size]}
      placeholder={<span aria-hidden>{initial}</span>}
      openPreviewAriaLabel={previewAriaLabel}
      closeAriaLabel={closeAriaLabel}
    />
  );
}

export function VeitPersonListRow({
  label,
  src,
  initial,
  size = 'md',
  className = '',
  nameClassName = '',
  subline,
  alt = '',
  previewAriaLabel,
  closeAriaLabel,
}: {
  label: string;
  src: string | null;
  initial: string;
  size?: 'sm' | 'md';
  className?: string;
  nameClassName?: string;
  subline?: ReactNode;
  alt?: string;
  previewAriaLabel: string;
  closeAriaLabel: string;
}) {
  const gap = size === 'sm' ? 'gap-2' : 'gap-3';
  return (
    <div className={`flex min-w-0 items-center ${gap} ${className}`.trim()}>
      <VeitPersonAvatarThumb
        src={src}
        initial={initial}
        size={size}
        alt={alt}
        previewAriaLabel={previewAriaLabel}
        closeAriaLabel={closeAriaLabel}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0">
        <span className={`truncate text-foreground ${nameClassName}`.trim()}>{label}</span>
        {subline != null && subline !== '' && <span className="truncate text-xs text-muted-foreground">{subline}</span>}
      </span>
    </div>
  );
}

export type VeitPersonListRowProfileProps = {
  /** Roher Anzeigename aus der API (darf leer sein). */
  displayName: string | null | undefined;
  profileImageSrc: string | null;
  /** Anzeige, wenn `displayName` leer und kein `labelOverride`/`Du` greift (i18n). */
  emptyNameLabel: string;
  labelOverride?: string | null;
  isCurrentUser?: boolean;
  /** Wird bei `isCurrentUser` als sichtbarer Name verwendet, wenn kein `labelOverride` gesetzt ist. */
  youLabel?: string;
  /**
   * Fallback-Name, wenn `displayName` leer (z. B. `#42`); hat Vorrang vor `emptyNameLabel`
   * für die sichtbare Zeile, nicht für den Avatar-Buchstaben (der nutzt `displayName ?? labelHint`).
   */
  labelHint?: string | null;
  subline?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
  nameClassName?: string;
  alt?: string;
  /** Wird zu `"{label}: {suffix}"` für die Profilbild-Lightbox-`aria-label`. */
  profilePreviewSuffix: string;
  closeAriaLabel: string;
};

/**
 * Zeile aus API-Rohdaten (`displayName` + Bild-URL) — gleiche Optik wie {@link VeitPersonListRow}.
 */
export function VeitPersonListRowProfile({
  displayName,
  profileImageSrc,
  emptyNameLabel,
  labelOverride,
  isCurrentUser = false,
  youLabel = '',
  labelHint,
  subline,
  size = 'md',
  className = '',
  nameClassName = '',
  alt = '',
  profilePreviewSuffix,
  closeAriaLabel,
}: VeitPersonListRowProfileProps) {
  const trimmedOverride = (labelOverride ?? '').trim();
  const you = (youLabel ?? '').trim();
  const effectiveOverride =
    trimmedOverride !== '' ? trimmedOverride : isCurrentUser && you !== '' ? you : '';
  const displayTrim = (displayName ?? '').trim();
  const hintTrim = (labelHint ?? '').trim();
  const label =
    effectiveOverride !== ''
      ? effectiveOverride
      : displayTrim !== ''
        ? displayTrim
        : hintTrim !== ''
          ? hintTrim
          : emptyNameLabel;
  const sourceForInitial =
    displayTrim !== '' ? displayName : hintTrim !== '' ? labelHint : (displayName ?? null);
  const initial = veitPersonAvatarInitial(
    sourceForInitial,
    effectiveOverride !== '' ? effectiveOverride : null,
  );
  const previewAriaLabel = `${label}: ${profilePreviewSuffix}`;
  return (
    <VeitPersonListRow
      label={label}
      src={profileImageSrc}
      initial={initial}
      size={size}
      className={className}
      nameClassName={nameClassName}
      subline={subline}
      alt={alt}
      previewAriaLabel={previewAriaLabel}
      closeAriaLabel={closeAriaLabel}
    />
  );
}

