import { X } from 'lucide-react';
import { tagColor } from '@veit/field-tags';

export type VeitFieldTagBadgeProps = {
  name: string;
  hex_color?: string | null;
  className?: string;
  /** `compact`: lists/cards; `field`: inline in form fields (picker). */
  variant?: 'compact' | 'field';
  title?: string;
  onRemove?: () => void;
  removeAriaLabel?: string;
  /** When set, badge becomes a button (e.g. apply tag filter). */
  onClick?: () => void;
  filterAriaLabel?: string;
};

/** Colored tag chip — shared styling for lists, tables, and pickers. */
export function VeitFieldTagBadge({
  name,
  hex_color,
  className = '',
  variant = 'compact',
  title,
  onRemove,
  removeAriaLabel,
  onClick,
  filterAriaLabel,
}: VeitFieldTagBadgeProps) {
  const isField = variant === 'field';
  const base = isField
    ? 'inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-white'
    : 'inline-block max-w-full truncate rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white';
  const interactive = onClick != null;
  const interactiveClass = interactive
    ? 'cursor-pointer transition-[filter] hover:brightness-95 active:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1'
    : '';
  const style = { backgroundColor: tagColor({ hex_color }) };
  const label = title ?? name;

  const content = (
    <>
      <span className={isField ? 'truncate' : undefined}>{name}</span>
      {onRemove ? (
        <button
          type="button"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md hover:bg-black/15"
          aria-label={removeAriaLabel ?? name}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      ) : null}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        className={`${base} ${interactiveClass} ${className}`.trim()}
        style={style}
        title={label}
        aria-label={filterAriaLabel ?? label}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={`${base} ${className}`.trim()} style={style} title={label}>
      {content}
    </span>
  );
}
