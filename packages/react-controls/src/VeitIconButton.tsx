import { cloneElement, forwardRef, isValidElement, type ReactElement, type ReactNode } from 'react';

import { VeitButton, type VeitButtonProps } from './VeitButton.js';

export type VeitIconButtonProps = Omit<VeitButtonProps, 'size' | 'aria-label' | 'title'> & {
  /** Accessible name and tooltip. */
  label: string;
  /** Tooltip when it should differ from `label`. */
  title?: string;
  icon: ReactNode;
  /** `default` is 44×44 px (touch target), `sm` 36×36 px for dense rows. */
  size?: 'default' | 'sm';
  /** With `asChild`, the single child (e.g. `<Link to="…" />`) is rendered with the button classes and gets the icon. */
  children?: ReactNode;
};

/** Square button that shows only an icon; `label` becomes `aria-label` and `title`. */
export const VeitIconButton = forwardRef<HTMLButtonElement, VeitIconButtonProps>(function VeitIconButton(
  { label, title, icon, variant = 'secondary', size = 'default', asChild = false, className = '', children, ...rest },
  ref,
) {
  const sizeClass = size === 'sm' ? 'btn-icon-sm' : '';
  const content =
    asChild && isValidElement(children) ? cloneElement(children as ReactElement<{ children?: ReactNode }>, undefined, icon) : icon;
  return (
    <VeitButton
      ref={ref}
      variant={variant}
      size={size === 'sm' ? 'default' : 'icon'}
      asChild={asChild}
      aria-label={label}
      title={title ?? label}
      className={`${sizeClass} ${className}`.trim()}
      {...rest}
    >
      {content}
    </VeitButton>
  );
});
