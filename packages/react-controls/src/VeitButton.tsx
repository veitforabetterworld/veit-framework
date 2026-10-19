import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type VeitButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';

export type VeitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: VeitButtonVariant;
  /** Rendert das Kind (z. B. einen Link) mit den Button-Klassen. */
  asChild?: boolean;
};

const VARIANT: Record<VeitButtonVariant, string> = {
  primary: 'btn btn-primary',
  secondary: 'btn btn-secondary',
  destructive: 'btn btn-destructive',
  ghost: 'btn btn-ghost',
};

export const VeitButton = forwardRef<HTMLButtonElement, VeitButtonProps>(function VeitButton(
  { variant = 'primary', className = '', type = 'button', asChild = false, ...rest },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type}
      className={`${VARIANT[variant]} ${className}`.trim()}
      {...rest}
    />
  );
});
