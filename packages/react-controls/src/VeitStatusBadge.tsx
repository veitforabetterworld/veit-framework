import type { ReactNode } from 'react';

export type VeitStatusBadgeVariant =
  | 'neutral'
  | 'inactive'
  | 'success'
  | 'warning'
  | 'primary'
  | 'destructive'
  | 'info';

const VARIANT_CLASS: Record<VeitStatusBadgeVariant, string> = {
  neutral: 'border-border/80 bg-muted/50 text-foreground/90',
  inactive: 'border-border/70 bg-surface-elevated text-foreground/85',
  success: 'border-primary/25 bg-primary/10 text-primary',
  warning: 'border-warning/25 bg-warning/10 text-warning-foreground',
  primary: 'border-primary/25 bg-primary/10 text-primary',
  destructive: 'border-destructive/25 bg-destructive/10 text-destructive',
  info: 'border-info/25 bg-info/10 text-info',
};

const SIZE_CLASS: Record<'sm' | 'md', string> = {
  sm: 'text-[11px] font-medium uppercase tracking-wide',
  md: 'text-xs font-medium',
};

const SHAPE_CLASS: Record<'pill' | 'rounded', string> = {
  pill: 'rounded-full',
  rounded: 'rounded-lg',
};

export type VeitStatusBadgeProps = {
  children: ReactNode;
  variant?: VeitStatusBadgeVariant;
  size?: 'sm' | 'md';
  icon?: ReactNode;
  shape?: 'pill' | 'rounded';
  className?: string;
};

export function VeitStatusBadge({
  children,
  variant = 'neutral',
  size = 'sm',
  icon,
  shape = 'pill',
  className = '',
}: VeitStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 ${SIZE_CLASS[size]} ${SHAPE_CLASS[shape]} ${VARIANT_CLASS[variant]} ${icon ? 'gap-1' : ''} ${className}`.trim()}
    >
      {icon}
      {children}
    </span>
  );
}
