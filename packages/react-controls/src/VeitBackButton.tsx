import { ArrowLeft } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { VeitButton } from './VeitButton.js';

const DEFAULT_CLASS = 'p-2 -m-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground';

type VeitBackButtonProps = {
  onBack: () => void;
  ariaLabel: string;
  title?: string;
  icon?: ReactNode;
  /** Visible text next to the icon; the button is then named by it instead of `ariaLabel`. */
  label?: string;
  /** Classes of the label span. */
  labelClassName?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>;

/** Back button on `VeitButton` (ghost). `className` replaces the default look, as before. */
export function VeitBackButton({
  onBack,
  ariaLabel,
  title,
  icon,
  label,
  labelClassName = 'min-w-0 truncate',
  className,
  ...rest
}: VeitBackButtonProps) {
  const text = label?.trim() ?? '';
  return (
    <VeitButton
      variant="ghost"
      onClick={onBack}
      aria-label={text ? undefined : ariaLabel}
      title={title ?? ariaLabel}
      // The ghost variant underlines on hover; a back button does not.
      className={`${className ?? DEFAULT_CLASS} hover:no-underline`}
      {...rest}
    >
      {icon ?? <ArrowLeft className="h-5 w-5" aria-hidden />}
      {text ? <span className={labelClassName}>{text}</span> : null}
    </VeitButton>
  );
}

export type { VeitBackButtonProps };
