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
      {leading ? <div className={`${bemPrefix}__leading`}>{leading}</div> : null}
      <div className={`${bemPrefix}__body`}>
        <div className={`${bemPrefix}__title`}>
          {title}
          {badge}
        </div>
        {meta != null && meta !== false ? <div className={`${bemPrefix}__meta`}>{meta}</div> : null}
      </div>
      {trailing ? <div className={`${bemPrefix}__trailing`}>{trailing}</div> : null}
      {actions ? <div className={`${bemPrefix}__actions`}>{actions}</div> : null}
    </>
  );

  return (
    <li className={`${bemPrefix} ${className}`.trim()} style={style}>
      {onClick ? (
        <button
          type={type}
          className={`${bemPrefix}__row ${bemPrefix}__row--button`}
          disabled={disabled}
          onClick={onClick}
          {...buttonProps}
        >
          {body}
        </button>
      ) : (
        <div className={`${bemPrefix}__row`}>{body}</div>
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
  return <ul className={`${bemPrefix} ${className}`.trim()}>{children}</ul>;
}
