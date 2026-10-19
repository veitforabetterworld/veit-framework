import type { ReactNode } from 'react';

export type VeitPageHeaderProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

/** Titelzeile mit optionalem führendem Element und Aktionen rechts. */
export function VeitPageHeader({ title, subtitle, leading, trailing, className = '' }: VeitPageHeaderProps) {
  return (
    <header className={`flex flex-wrap items-start justify-between gap-3 ${className}`.trim()}>
      <div className="flex min-w-0 items-start gap-3">
        {leading}
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {trailing ? <div className="flex flex-wrap items-center gap-2">{trailing}</div> : null}
    </header>
  );
}
