import type { ReactNode } from 'react';
import { VeitCountBadge } from './VeitCountBadge.js';

export type VeitTabBarItem<T extends string = string> = {
  id: T;
  label: ReactNode;
  /** Optional count badge; hidden when 0 or undefined. */
  badge?: number;
  disabled?: boolean;
};

export type VeitTabBarProps<T extends string = string> = {
  value: T;
  onChange: (value: T) => void;
  items: readonly VeitTabBarItem<T>[];
  ariaLabel?: string;
  className?: string;
};

function tabButtonClass(active: boolean): string {
  return `rounded-lg px-3 py-2 text-sm ${
    active ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground'
  }`;
}

export function VeitTabBar<T extends string = string>({
  value,
  onChange,
  items,
  ariaLabel,
  className = '',
}: VeitTabBarProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex flex-wrap items-center gap-2 border-b border-border/60 pb-1${className ? ` ${className}` : ''}`}
    >
      {items.map((item) => {
        const active = value === item.id;
        const showBadge = item.badge != null && item.badge > 0;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            className={`${tabButtonClass(active)}${showBadge ? ' relative' : ''}`}
            onClick={() => onChange(item.id)}
          >
            {item.label}
            {showBadge ? <VeitCountBadge count={item.badge!} size="tab" className="ml-1.5" /> : null}
          </button>
        );
      })}
    </div>
  );
}
