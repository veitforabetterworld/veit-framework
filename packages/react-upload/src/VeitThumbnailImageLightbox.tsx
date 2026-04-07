import { useState, useEffect, useRef, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

export type VeitThumbnailImageLightboxMode = 'view' | 'editable';

type Shared = {
  src: string | null;
  alt?: string;
  placeholder?: ReactNode;
  className?: string;
  thumbnailClassName?: string;
  openPreviewAriaLabel?: string;
  disabled?: boolean;
  inputAccept?: string;
  capture?: 'user' | 'environment';
  removeAriaLabel?: string;
  editAriaLabel?: string;
  closeAriaLabel: string;
  uploadFallbackLabel?: string;
};

export type VeitThumbnailImageLightboxProps =
  | ({ mode: 'view' } & Shared)
  | ({ mode: 'editable'; onRemove: () => void; onFileChange?: (e: React.ChangeEvent<HTMLInputElement>) => void } & Shared);

const defaultThumb = 'flex items-center justify-center overflow-hidden border border-border bg-muted/30 touch-manipulation';

export function VeitThumbnailImageLightbox(props: VeitThumbnailImageLightboxProps) {
  const {
    src, alt = '', mode, placeholder, className = '', thumbnailClassName = `h-20 w-20 rounded-button ${defaultThumb}`,
    openPreviewAriaLabel = 'Open image preview', disabled = false, inputAccept = 'image/*', capture,
    removeAriaLabel = 'Delete', editAriaLabel = 'Edit', closeAriaLabel, uploadFallbackLabel = 'Choose file'
  } = props;
  const editable = mode === 'editable';
  const onFileChange = editable ? props.onFileChange : undefined;
  const onRemove = editable ? props.onRemove : undefined;
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewOpen]);

  const canInteract = !disabled && (!!src || editable);
  const handleThumbClick = () => {
    if (disabled) return;
    if (!src) return onFileChange ? fileInputRef.current?.click() : undefined;
    setPreviewOpen(true);
  };
  const handleThumbKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    handleThumbClick();
  };

  return (
    <>
      <div
        role={canInteract ? 'button' : undefined}
        tabIndex={canInteract ? 0 : undefined}
        className={`${thumbnailClassName} ${className} ${!canInteract ? 'cursor-default' : 'cursor-pointer'}`.trim()}
        onClick={(e) => { e.stopPropagation(); handleThumbClick(); }}
        onKeyDown={canInteract ? handleThumbKeyDown : undefined}
        aria-disabled={disabled || undefined}
        aria-label={src ? openPreviewAriaLabel : editable ? uploadFallbackLabel : undefined}
      >
        {src ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : (placeholder ?? <span aria-hidden>+</span>)}
      </div>
      {editable && onFileChange && (
        <input
          ref={fileInputRef}
          type="file"
          accept={inputAccept}
          className="hidden"
          capture={capture}
          disabled={disabled}
          onChange={(e) => { onFileChange(e); setPreviewOpen(false); }}
        />
      )}
      {previewOpen && src && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={closeAriaLabel} onClick={() => setPreviewOpen(false)}>
          <div className="relative max-h-[85vh] max-w-[95vw] shrink-0">
            <img src={src} alt={alt} className="max-h-[85vh] max-w-[95vw] rounded-card object-contain shadow-lg" />
            {editable && src && !disabled && (
              <button type="button" className="absolute left-2 top-2 rounded-full border border-border bg-background/95 p-2 text-destructive shadow-lg hover:bg-destructive/10" aria-label={removeAriaLabel} title={removeAriaLabel}
                onClick={(e) => { e.stopPropagation(); onRemove?.(); setPreviewOpen(false); }}>
                x
              </button>
            )}
            {editable && onFileChange && (
              <button type="button" className="absolute right-2 top-2 rounded-full border border-border bg-background/95 p-2 shadow-lg hover:bg-muted" aria-label={editAriaLabel} title={editAriaLabel}
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                *
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
