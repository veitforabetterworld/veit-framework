import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { VeitConfirmDialog } from '@veit/react-dialog';

export type VeitDeleteConfirmConfig = {
  title: ReactNode;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  closeAriaLabel?: string;
  backdropDismissLabel?: string;
  zIndexBase?: number;
  disabled?: boolean;
  blockBackdropClose?: boolean;
};

export type VeitDeleteButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  children: ReactNode;
  icon?: ReactNode;
  /** Öffnet vor der Aktion einen {@link VeitConfirmDialog}; bei Bestätigung wird `onClick` ausgeführt. */
  deleteConfirm?: VeitDeleteConfirmConfig;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
};

export function VeitDeleteButton({
  children,
  className = '',
  icon,
  deleteConfirm,
  onClick,
  disabled,
  ...rest
}: VeitDeleteButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const runAction = async () => {
    if (!onClick) return;
    await Promise.resolve(
      onClick({ preventDefault() {}, stopPropagation() {} } as React.MouseEvent<HTMLButtonElement>),
    );
  };

  return (
    <>
      <button
        className={`inline-flex min-h-[2.5rem] items-center justify-center gap-2 btn-destructive ${className}`.trim()}
        disabled={disabled}
        onClick={
          deleteConfirm
            ? (e) => {
                e.preventDefault();
                if (disabled) return;
                setConfirmOpen(true);
              }
            : onClick
        }
        {...rest}
        type="button"
      >
        {icon ?? <span aria-hidden>🗑</span>}
        {children}
      </button>
      {deleteConfirm ? (
        <VeitConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title={deleteConfirm.title}
          message={deleteConfirm.message}
          confirmLabel={deleteConfirm.confirmLabel}
          cancelLabel={deleteConfirm.cancelLabel}
          destructive={deleteConfirm.destructive ?? true}
          closeAriaLabel={deleteConfirm.closeAriaLabel}
          backdropDismissLabel={deleteConfirm.backdropDismissLabel}
          zIndexBase={deleteConfirm.zIndexBase}
          disabled={disabled ?? deleteConfirm.disabled}
          blockBackdropClose={deleteConfirm.blockBackdropClose}
          onConfirm={async () => {
            try {
              await runAction();
            } finally {
              setConfirmOpen(false);
            }
          }}
        />
      ) : null}
    </>
  );
}
