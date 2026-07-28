import type { ReactNode } from 'react';

export type VeitProgressBarProps = {
  /** 0–100 */
  value: number;
  className?: string;
  fillClassName?: string;
  'aria-label'?: string;
};

export const veitProgressBarTrackClass = 'h-2 w-full overflow-hidden rounded-full bg-muted/40';
export const veitProgressBarFillClass = 'h-full rounded-full bg-primary transition-[width]';

export function VeitProgressBar({
  value,
  className = '',
  fillClassName = veitProgressBarFillClass,
  'aria-label': ariaLabel,
}: VeitProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`${veitProgressBarTrackClass} ${className}`.trim()}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={ariaLabel}
    >
      <div className={fillClassName} style={{ width: `${pct}%` }} />
    </div>
  );
}

export type VeitPanelCardProps = {
  children: ReactNode;
  className?: string;
  hover?: boolean;
};

/** Standard panel wrapper around `.card` / `.card-hover`. */
export function VeitPanelCard({ children, className = '', hover = false }: VeitPanelCardProps) {
  return <div className={`${hover ? 'card-hover' : 'card'} ${className}`.trim()}>{children}</div>;
}
