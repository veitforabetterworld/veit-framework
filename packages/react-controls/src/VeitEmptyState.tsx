import type { ReactNode } from 'react';

export type VeitEmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  embedded?: boolean;
  className?: string;
  /** BEM root prefix for host CSS (default `veit-empty`). */
  bemPrefix?: string;
};

/**
 * Empty list / empty page placeholder.
 * Hosts may set `bemPrefix` (e.g. `sg-empty`) to keep existing stylesheet selectors.
 */
export function VeitEmptyState({
  title,
  description,
  icon,
  action,
  embedded,
  className = '',
  bemPrefix = 'veit-empty',
}: VeitEmptyStateProps) {
  return (
    <div
      className={`${bemPrefix}${embedded ? ` ${bemPrefix}--embedded` : ''} ${className}`.trim()}
      role="status"
    >
      {icon ? (
        <div className={`${bemPrefix}__icon`} aria-hidden>
          {icon}
        </div>
      ) : null}
      <p className={`${bemPrefix}__title`}>{title}</p>
      {description ? <p className={`${bemPrefix}__text`}>{description}</p> : null}
      {action ? <div className={`${bemPrefix}__action`}>{action}</div> : null}
    </div>
  );
}
