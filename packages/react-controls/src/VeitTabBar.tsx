import type { ReactNode } from 'react';

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

function formatBadge(n: number): string {
  return n > 99 ? '99+' : String(n);
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
      className={`flex flex-wrap gap-2 border-b border-border/60 pb-2${className ? ` ${className}` : ''}`}
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
            {showBadge ? (
              <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {formatBadge(item.badge!)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
