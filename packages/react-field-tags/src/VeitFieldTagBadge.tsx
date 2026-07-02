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
}: VeitFieldTagBadgeProps) {
  const isField = variant === 'field';
  const base = isField
    ? 'inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-white'
    : 'inline-block max-w-full truncate rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white';

  return (
    <span
      className={`${base} ${className}`.trim()}
      style={{ backgroundColor: tagColor({ hex_color }) }}
      title={title ?? name}
    >
      <span className={isField ? 'truncate' : undefined}>{name}</span>
      {onRemove ? (
        <button
          type="button"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md hover:bg-black/15"
          aria-label={removeAriaLabel ?? name}
          onClick={onRemove}
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      ) : null}
    </span>
  );
}
