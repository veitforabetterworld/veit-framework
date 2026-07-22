import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { ImageUp, Loader2, Trash2, X } from 'lucide-react';
import { VeitConfirmDialog } from '@veit/react-dialog';

const Z_LIGHTBOX = 12000;
const Z_PICK_MENU = 12100;

export type VeitImagePickerShape = 'circle' | 'rounded';

/** `camera`: leere Fläche öffnet direkt die Kamera. `general`: Nutzer wählt Kamera oder Galerie. */
export type VeitImagePickerSourceMode = 'general' | 'camera';

export type VeitImagePickerI18n = {
  openPreview: string;
  pickCamera: string;
  pickFile: string;
  replace: string;
  deleteSr: string;
  closeLightbox: string;
  backdropDismiss: string;
  /** Aria-Label auf der Miniatur während `onPick` noch läuft (Upload). */
  uploading?: string;
  deleteConfirm?: {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    closeAriaLabel: string;
    backdropDismissLabel: string;
    disabled?: boolean;
    blockBackdropClose?: boolean;
  };
};

type Base = {
  src: string | null;
  alt?: string;
  shape?: VeitImagePickerShape;
  /** Zusätzliche Klassen für die Miniatur (Größe, Rahmen). */
  thumbnailClassName?: string;
  className?: string;
  disabled?: boolean;
  /** Wenn kein Bild: ein Buchstabe (z. B. Anfangsbuchstabe Name/Organisation). */
  avatarLetter?: string;
  /** Wenn kein Bild und kein Buchstabe: z. B. Icon. */
  emptyFallback?: ReactNode;
  inputAccept?: string;
};

export type VeitImagePickerViewProps = Base & {
  mode: 'view';
  openPreviewAriaLabel: string;
  /** Aria-Label Schließen-Button im Vollbild (Standard: gleich {@link openPreviewAriaLabel}). */
  lightboxCloseAriaLabel?: string;
};

export type VeitImagePickerEditableProps = Base & {
  mode: 'editable';
  sourceMode: VeitImagePickerSourceMode;
  /** Nur Kamera-Pfad: `user` Selfie / `environment` Außenkamera (Standard). */
  cameraFacing?: 'user' | 'environment';
  strings: VeitImagePickerI18n;
  onPick: (file: File) => void | Promise<void>;
  onRemove: () => void | Promise<void>;
};

export type VeitImagePickerProps = VeitImagePickerViewProps | VeitImagePickerEditableProps;

function shapeRadiusClass(shape: VeitImagePickerShape | undefined): string {
  return (shape ?? 'rounded') === 'circle' ? 'rounded-full' : 'rounded-2xl';
}

function letterFromProps(avatarLetter: string | undefined): string {
  const c = (avatarLetter ?? '').trim().charAt(0);
  return c ? c.toUpperCase() : '';
}

export function VeitImagePicker(props: VeitImagePickerProps) {
  const {
    src,
    alt = '',
    shape,
    thumbnailClassName,
    className = '',
    disabled = false,
    avatarLetter,
    emptyFallback,
    inputAccept = 'image/*',
  } = props;

  const editable = props.mode === 'editable';
  const strings = editable ? props.strings : undefined;
  const sourceMode = editable ? props.sourceMode : undefined;
  const cameraFacing = editable ? (props.cameraFacing ?? 'environment') : 'environment';
  const onPick = editable ? props.onPick : undefined;
  const onRemove = editable ? props.onRemove : undefined;

  const [previewOpen, setPreviewOpen] = useState(false);
  const [pickMenuOpen, setPickMenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const fileGalleryRef = useRef<HTMLInputElement>(null);
  const fileCameraRef = useRef<HTMLInputElement>(null);
  const pickWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!previewOpen) {
      setDeleteConfirmOpen(false);
      return;
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewOpen]);

  useEffect(() => {
    if (!pickMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = pickWrapRef.current;
      if (el && !el.contains(e.target as Node)) setPickMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [pickMenuOpen]);

  const runPick = useCallback(
    async (file: File | undefined | null) => {
      if (!file || !onPick) return;
      setUploadBusy(true);
      try {
        await Promise.resolve(onPick(file));
      } finally {
        setUploadBusy(false);
      }
    },
    [onPick],
  );

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      setPickMenuOpen(false);
      await runPick(file);
    },
    [runPick],
  );

  const letter = letterFromProps(avatarLetter);
  const radius = shapeRadiusClass(shape);
  const thumbSurface = src
    ? 'border border-border bg-muted'
    : 'border border-primary/25 bg-primary-container';
  const thumbClass = [
    'relative flex shrink-0 items-center justify-center overflow-hidden',
    thumbSurface,
    'ring-2 ring-transparent transition-shadow',
    'touch-manipulation',
    radius,
    thumbnailClassName ?? 'h-20 w-20',
    disabled || uploadBusy ? 'cursor-default opacity-60' : 'cursor-pointer hover:ring-border/70',
    'focus-visible:outline-none focus-visible:ring-primary/40',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const openEmptyPicker = () => {
    if (!editable || disabled || uploadBusy || !onPick) return;
    if (sourceMode === 'camera') {
      fileCameraRef.current?.click();
      return;
    }
    setPickMenuOpen(true);
  };

  const handleThumbClick = () => {
    if (disabled || uploadBusy) return;
    if (!src) {
      openEmptyPicker();
      return;
    }
    setPreviewOpen(true);
  };

  const handleThumbKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    handleThumbClick();
  };

  const canThumbFocus = !disabled && (!!src || editable);
  const viewOpenLabel = props.mode === 'view' ? props.openPreviewAriaLabel : (strings?.openPreview ?? '');
  const viewLightboxCloseLabel =
    props.mode === 'view' ? (props.lightboxCloseAriaLabel ?? props.openPreviewAriaLabel) : (strings?.backdropDismiss ?? '');

  const emptyInner =
    letter !== '' ? (
      <span
        className="select-none font-headline text-3xl font-semibold tabular-nums leading-none text-primary"
        aria-hidden
      >
        {letter}
      </span>
    ) : (
      (emptyFallback ?? (
        <span
          className="select-none font-headline text-2xl font-semibold leading-none text-primary/90"
          aria-hidden
        >
          ?
        </span>
      ))
    );

  const replaceFromLightbox = () => {
    setPreviewOpen(false);
    if (sourceMode === 'camera') {
      fileCameraRef.current?.click();
    } else {
      fileGalleryRef.current?.click();
    }
  };

  const overlayDeleteConfirm = strings?.deleteConfirm;

  const runRemove = async () => {
    if (!onRemove) return;
    await Promise.resolve(onRemove());
    setPreviewOpen(false);
    setDeleteConfirmOpen(false);
  };

  return (
    <div ref={pickWrapRef} className={`relative inline-flex ${className}`.trim()}>
      {editable ? (
        <>
          <input
            ref={fileGalleryRef}
            type="file"
            accept={inputAccept}
            className="hidden"
            disabled={disabled || uploadBusy}
            onChange={handleFileInputChange}
          />
          <input
            ref={fileCameraRef}
            type="file"
            accept={inputAccept}
            capture={cameraFacing}
            className="hidden"
            disabled={disabled || uploadBusy}
            onChange={handleFileInputChange}
          />
        </>
      ) : null}

      <div
        role={canThumbFocus ? 'button' : undefined}
        tabIndex={canThumbFocus ? 0 : undefined}
        className={thumbClass}
        onClick={(e) => {
          e.stopPropagation();
          handleThumbClick();
        }}
        onKeyDown={canThumbFocus ? handleThumbKeyDown : undefined}
        aria-disabled={disabled || uploadBusy || undefined}
        aria-busy={uploadBusy || undefined}
        aria-label={
          uploadBusy
            ? (strings?.uploading ?? 'Uploading…')
            : src
              ? viewOpenLabel
              : editable && strings
                ? `${strings.pickCamera}, ${strings.pickFile}`
                : viewOpenLabel
        }
      >
        {src ? (
          <img src={src} alt={alt} className="h-full w-full object-cover" />
        ) : (
          emptyInner
        )}
        {uploadBusy ? (
          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center ${radius} bg-background/60 backdrop-blur-[1px]`}
            aria-hidden
          >
            <Loader2
              className="h-[35%] w-[35%] min-h-[1.25rem] min-w-[1.25rem] max-w-[1.75rem] animate-spin text-primary motion-reduce:animate-none"
              strokeWidth={2}
            />
          </div>
        ) : null}
      </div>

      {editable && pickMenuOpen && sourceMode === 'general' && !src && strings ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-[12100] mt-1 min-w-[11rem] rounded-xl border border-border bg-background py-1 shadow-lg"
          style={{ zIndex: Z_PICK_MENU }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="block w-full px-3 py-2.5 text-left text-sm hover:bg-muted"
            onClick={() => {
              setPickMenuOpen(false);
              fileCameraRef.current?.click();
            }}
          >
            {strings.pickCamera}
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2.5 text-left text-sm hover:bg-muted"
            onClick={() => {
              setPickMenuOpen(false);
              fileGalleryRef.current?.click();
            }}
          >
            {strings.pickFile}
          </button>
        </div>
      ) : null}

      {previewOpen && src && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 flex items-center justify-center bg-black/75 p-4"
              style={{ zIndex: Z_LIGHTBOX }}
              role="dialog"
              aria-modal="true"
              aria-label={editable ? strings?.closeLightbox : viewOpenLabel}
              onClick={() => setPreviewOpen(false)}
            >
              <div
                className="relative max-h-[88vh] max-w-[96vw]"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={src}
                  alt={alt}
                  className={`max-h-[85vh] max-w-[95vw] object-contain shadow-2xl ${radius}`.trim()}
                />
                {editable && strings && onRemove && !disabled ? (
                  <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex justify-center gap-3 pb-4 pt-10">
                    <button
                      type="button"
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/35 bg-black/50 text-white shadow-lg backdrop-blur-sm hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                      aria-label={strings.replace}
                      title={strings.replace}
                      onClick={replaceFromLightbox}
                    >
                      <ImageUp className="h-5 w-5" strokeWidth={2} aria-hidden />
                    </button>
                    {overlayDeleteConfirm ? (
                      <>
                        <button
                          type="button"
                          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/35 bg-red-600/90 text-white shadow-lg hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                          aria-label={strings.deleteSr}
                          title={strings.deleteSr}
                          onClick={() => setDeleteConfirmOpen(true)}
                        >
                          <Trash2 className="h-5 w-5" strokeWidth={2} aria-hidden />
                        </button>
                        <VeitConfirmDialog
                          open={deleteConfirmOpen}
                          onClose={() => setDeleteConfirmOpen(false)}
                          title={overlayDeleteConfirm.title}
                          message={overlayDeleteConfirm.message}
                          confirmLabel={overlayDeleteConfirm.confirmLabel}
                          cancelLabel={overlayDeleteConfirm.cancelLabel}
                          destructive
                          closeAriaLabel={overlayDeleteConfirm.closeAriaLabel}
                          backdropDismissLabel={overlayDeleteConfirm.backdropDismissLabel}
                          disabled={disabled || overlayDeleteConfirm.disabled}
                          blockBackdropClose={overlayDeleteConfirm.blockBackdropClose}
                          onConfirm={() => void runRemove()}
                        />
                      </>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/35 bg-red-600/90 text-white shadow-lg hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                        aria-label={strings.deleteSr}
                        title={strings.deleteSr}
                        onClick={() => void runRemove()}
                      >
                        <Trash2 className="h-5 w-5" strokeWidth={2} aria-hidden />
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="absolute right-3 top-3 inline-flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-full border border-white/30 bg-black/40 text-white hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                aria-label={viewLightboxCloseLabel}
                onClick={() => setPreviewOpen(false)}
              >
                <X className="h-5 w-5" strokeWidth={2} aria-hidden />
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
