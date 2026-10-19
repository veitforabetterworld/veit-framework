import { ArrowLeft } from 'lucide-react';
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
      className={className ?? 'p-2 -m-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground'}
      {...rest}
    >
      {icon ?? <ArrowLeft className="h-5 w-5" aria-hidden />}
    </button>
  );
}

export type { VeitBackButtonProps };
