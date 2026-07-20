export type VeitCountBadgeProps = {
  count: number;
  /** Default true — render nothing when count is 0 or less. */
  hideWhenZero?: boolean;
  /** tab = inline pill next to labels; nav = fixed circle in header nav. */
  size?: 'tab' | 'nav';
  className?: string;
  'aria-label'?: string;
};

export function formatVeitCountBadge(n: number): string {
  return n > 99 ? '99+' : String(n);
}

const SIZE_CLASS: Record<NonNullable<VeitCountBadgeProps['size']>, string> = {
  tab: 'inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground',
  nav: 'flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-on-primary',
};

export function VeitCountBadge({
  count,
  hideWhenZero = true,
  size = 'tab',
  className = '',
  'aria-label': ariaLabel,
}: VeitCountBadgeProps) {
  if (hideWhenZero && count <= 0) return null;
  return (
    <span className={`${SIZE_CLASS[size]}${className ? ` ${className}` : ''}`} aria-label={ariaLabel}>
      {formatVeitCountBadge(count)}
    </span>
  );
}
