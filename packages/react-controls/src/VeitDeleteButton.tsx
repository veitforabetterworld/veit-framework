import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { VeitConfirmDialog, type VeitDeleteConfirmConfig } from '@veit/react-dialog';

export type { VeitDeleteConfirmConfig };

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
        {icon ?? <Trash2 className="h-4 w-4 shrink-0" aria-hidden />}
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
          disabled={disabled ?? deleteConfirm.disabled}
          blockBackdropClose={deleteConfirm.blockBackdropClose}
          onConfirm={runAction}
        />
      ) : null}
    </>
  );
}
