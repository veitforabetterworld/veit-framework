import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type VeitRoundIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'type'> & {
  children: ReactNode;
  variant?: 'secondary' | 'primary';
  type?: 'button';
};

const variantClass: Record<NonNullable<VeitRoundIconButtonProps['variant']>, string> = {
  secondary: 'btn-secondary',
  primary: 'btn-primary',
};

/**
 * Quadratischer Icon-Button (z.B. User+, QR) — gleiche Optik wie bei Berechtigungsgruppen.
 */
export function VeitRoundIconButton({
  children,
  variant = 'secondary',
  type = 'button',
  ...rest
}: VeitRoundIconButtonProps) {
  return (
    <button
      type={type}
      className={`${variantClass[variant]} inline-flex size-11 shrink-0 items-center justify-center rounded-xl p-0`}
      {...rest}
    >
      {children}
    </button>
  );
}
