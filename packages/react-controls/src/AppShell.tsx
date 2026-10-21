import type { ReactNode } from 'react';

const VARIANT = {
  page: 'flex min-h-screen flex-col',
  viewport: 'flex h-dvh max-h-dvh flex-col overflow-hidden',
  center: 'grid min-h-dvh place-items-center p-4',
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
