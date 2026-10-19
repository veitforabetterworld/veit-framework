import type { ReactNode } from 'react';

export type VeitAppHeaderProps = {
  brand?: ReactNode;
  nav?: ReactNode;
  tools?: ReactNode;
  className?: string;
  /** `compact` bleibt auch auf schmalen Screens eine Zeile. */
  density?: 'regular' | 'compact';
};

/** App-Leiste ohne Markenname und ohne Routen. Der Host füllt die Slots. */
export function VeitAppHeader({ brand, nav, tools, className = '', density = 'regular' }: VeitAppHeaderProps) {
  const bar =
    density === 'compact'
      ? 'flex-row flex-nowrap items-center gap-2 px-3 py-2'
      : 'flex-col gap-3 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4';
  return (
    <header
      className={`relative z-40 flex border-b border-border bg-card text-foreground ${bar} ${className}`.trim()}
    >
      {brand ? <div className="min-w-0 shrink-0">{brand}</div> : null}
      {nav ? (
        <div className={density === 'compact' ? 'min-w-0 flex-1' : 'min-w-0 w-full flex-1 sm:w-auto'}>{nav}</div>
      ) : null}
      {tools ? (
        <div className={`flex items-center gap-2 ${density === 'compact' ? 'shrink-0' : 'min-w-0 flex-wrap'}`}>{tools}</div>
      ) : null}
    </header>
  );
}

export type VeitAppFooterProps = {
  children: ReactNode;
  className?: string;
};

export function VeitAppFooter({ children, className = '' }: VeitAppFooterProps) {
  return (
    <footer className={`border-t border-border bg-card px-6 py-4 text-sm text-muted-foreground ${className}`.trim()}>
      {children}
    </footer>
  );
}
