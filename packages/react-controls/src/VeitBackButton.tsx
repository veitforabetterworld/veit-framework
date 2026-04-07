import type { ButtonHTMLAttributes, ReactNode } from 'react';

type VeitBackButtonProps = {
  onBack: () => void;
  ariaLabel: string;
  title?: string;
  icon?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>;

export function VeitBackButton({
  onBack,
  ariaLabel,
  title,
  icon,
  className,
  ...rest
}: VeitBackButtonProps) {
  return (
    <button
      type="button"
      onClick={onBack}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
      className={className ?? 'p-2 -m-2 rounded-button text-muted-foreground hover:bg-muted hover:text-foreground'}
      {...rest}
    >
      {icon ?? <span aria-hidden>←</span>}
    </button>
  );
}

export type { VeitBackButtonProps };
