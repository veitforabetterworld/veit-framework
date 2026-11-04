import type { ReactNode } from 'react';

const VARIANT = {
  page: 'flex min-h-screen flex-col',
  viewport: 'flex h-dvh max-h-dvh flex-col overflow-hidden',
  center: 'grid min-h-dvh place-items-center p-4',
  /** Pinned to the window (`fixed inset-0`): the page itself never scrolls, also not behind mobile browser bars. */
  fixed: 'fixed inset-0 flex flex-col overflow-hidden',
} as const;

export type AppShellVariant = keyof typeof VARIANT;

export function AppShell({
  variant,
  className = '',
  children,
}: {
  variant: AppShellVariant;
  className?: string;
  children: ReactNode;
}) {
  return <div className={`bg-background text-foreground ${VARIANT[variant]} ${className}`.trim()}>{children}</div>;
}
