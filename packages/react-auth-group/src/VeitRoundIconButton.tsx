import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { VeitButton } from '@veit/react-controls';

export type VeitRoundIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'type'> & {
  children: ReactNode;
  variant?: 'secondary' | 'primary';
  type?: 'button';
};

/**
 * Quadratischer Icon-Button (z.B. User+, QR) — gleiche Optik wie bei Berechtigungsgruppen.
 * `VeitButton` mit `size="icon"`; für neue Stellen `VeitIconButton` aus `@veit/react-controls` (mit `label`).
 */
export function VeitRoundIconButton({ children, variant = 'secondary', type = 'button', ...rest }: VeitRoundIconButtonProps) {
  return (
    <VeitButton variant={variant} size="icon" type={type} {...rest}>
      {children}
    </VeitButton>
  );
}
