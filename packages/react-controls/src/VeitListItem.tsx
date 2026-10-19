import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

export type VeitListItemProps = {
  title: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  disabled?: boolean;
  /** BEM root prefix for host CSS (default `veit-list-item`). */
  bemPrefix?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title' | 'children' | 'onClick' | 'disabled' | 'style'>;

/**
 * Display list row (leading / title / meta / actions). Not person-avatar specific
 * (see {@link VeitPersonListRow}).
 */
export function VeitListItem({
  title,
  meta,
  leading,
  trailing,
  actions,
  badge,
  footer,
  className = '',
  style,
  onClick,
  disabled,
  type = 'button',
  bemPrefix = 'veit-list-item',
  ...buttonProps
}: VeitListItemProps) {
  const body = (
    <>
      {leading ? <div className={`${bemPrefix}__leading shrink-0`}>{leading}</div> : null}
      <div className={`${bemPrefix}__body min-w-0 flex-1`}>
        <div className={`${bemPrefix}__title flex items-center gap-2 text-sm font-medium text-foreground`}>
          {title}
          {badge}
        </div>
        {meta != null && meta !== false ? (
          <div className={`${bemPrefix}__meta text-xs text-muted-foreground`}>{meta}</div>
        ) : null}
      </div>
      {trailing ? <div className={`${bemPrefix}__trailing shrink-0`}>{trailing}</div> : null}
      {actions ? <div className={`${bemPrefix}__actions shrink-0`}>{actions}</div> : null}
    </>
  );

  return (
    <li className={`${bemPrefix} ${className}`.trim()} style={style}>
      {onClick ? (
        <button
          type={type}
          className={`${bemPrefix}__row ${bemPrefix}__row--button flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted disabled:opacity-50`}
          disabled={disabled}
          onClick={onClick}
          {...buttonProps}
        >
          {body}
        </button>
      ) : (
        <div className={`${bemPrefix}__row flex items-start gap-2`}>{body}</div>
      )}
      {footer}
    </li>
  );
}

export function VeitList({
  children,
  className = '',
  bemPrefix = 'veit-list',
}: {
  children: ReactNode;
  className?: string;
  bemPrefix?: string;
}) {
  return <ul className={`${bemPrefix} m-0 list-none p-0 ${className}`.trim()}>{children}</ul>;
}
