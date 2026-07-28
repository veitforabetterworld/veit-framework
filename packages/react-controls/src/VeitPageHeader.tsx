import type { ReactNode } from 'react';

export type VeitPageHeaderProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  /** BEM root prefix for host CSS (default `veit-page-header`). */
  bemPrefix?: string;
};

/**
 * Page title row with optional leading control (back) and trailing actions.
 */
export function VeitPageHeader({
  title,
  subtitle,
  leading,
  trailing,
  className = '',
  bemPrefix = 'veit-page-header',
}: VeitPageHeaderProps) {
  return (
    <header className={`${bemPrefix} ${className}`.trim()}>
      <div className={`${bemPrefix}__start`}>
        {leading}
        <div className={`${bemPrefix}__titles`}>
          <h1 className={`${bemPrefix}__title`}>{title}</h1>
          {subtitle ? <p className={`${bemPrefix}__subtitle`}>{subtitle}</p> : null}
        </div>
      </div>
      {trailing ? <div className={`${bemPrefix}__actions`}>{trailing}</div> : null}
    </header>
  );
}
