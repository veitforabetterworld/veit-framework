import type { ReactNode } from 'react';

export type VeitAppHeaderProps = {
  brand?: ReactNode;
  nav?: ReactNode;
  tools?: ReactNode;
  className?: string;
};

/** App-Leiste ohne Markenname und ohne Routen. Der Host füllt die Slots. */
export function VeitAppHeader({ brand, nav, tools, className = '' }: VeitAppHeaderProps) {
  return (
    <header
      className={`relative z-40 flex flex-wrap items-end justify-between gap-4 border-b border-border bg-card px-6 py-4 text-foreground ${className}`.trim()}
    >
      {brand ? <div className="min-w-0">{brand}</div> : null}
      {nav}
      {tools ? <div className="flex items-center gap-3">{tools}</div> : null}
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
