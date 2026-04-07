import type { ReactNode } from 'react';
import { VeitThumbnailImageLightbox } from '@veit/react-upload';

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
