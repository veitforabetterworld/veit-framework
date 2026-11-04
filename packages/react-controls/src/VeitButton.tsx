import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type VeitButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';

/** `icon` is a square 44 px button for a single icon; `sm` replaces `className="btn-sm"`. */
export type VeitButtonSize = 'sm' | 'default' | 'lg' | 'icon';

export type VeitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: VeitButtonVariant;
  size?: VeitButtonSize;
  /** Rendert das Kind (z. B. einen Link) mit den Button-Klassen. */
  asChild?: boolean;
};

const VARIANT: Record<VeitButtonVariant, string> = {
  primary: 'btn btn-primary',
  secondary: 'btn btn-secondary',
  destructive: 'btn btn-destructive',
  ghost: 'btn btn-ghost',
};

const SIZE: Record<VeitButtonSize, string> = {
  sm: 'btn-sm',
  default: '',
  lg: 'btn-lg',
  icon: 'btn-icon',
};

/** The classes of a VeitButton, for elements that can not be one (e.g. a label around a file input). */
export function veitButtonClass(variant: VeitButtonVariant = 'primary', size: VeitButtonSize = 'default'): string {
  return `${VARIANT[variant]} ${SIZE[size]}`.trim();
}

export const VeitButton = forwardRef<HTMLButtonElement, VeitButtonProps>(function VeitButton(
  { variant = 'primary', size = 'default', className = '', type = 'button', asChild = false, ...rest },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type}
      className={`${veitButtonClass(variant, size)} ${className}`.trim()}
      {...rest}
    />
  );
});
