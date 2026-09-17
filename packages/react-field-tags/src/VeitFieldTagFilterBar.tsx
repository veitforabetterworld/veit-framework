import { useMemo } from 'react';
import { Filter } from 'lucide-react';
import type { TagPickerOption } from '@veit/field-tags';
import { tagColor } from '@veit/field-tags';
import { VeitFieldTagBadge } from './VeitFieldTagBadge.js';

export type VeitFieldTagFilterBarProps = {
  /** Panel heading, e.g. field name or "Budget filter". */
  title: string;
  /** Label for the "show all" chip. */
  allLabel: string;
  options: TagPickerOption[];
  value: number | null;
  onChange: (tagId: number | null) => void;
  disabled?: boolean;
  className?: string;
};

/** Pill-bar filter for hierarchical field tags (budget, kanban labels, person tags, …). */
export function VeitFieldTagFilterBar({
  title,
  allLabel,
  options,
  value,
  onChange,
  disabled,
  className = '',
}: VeitFieldTagFilterBarProps) {
  const selectedOption = useMemo(
    () => (value != null ? options.find((o) => o.id === value) : undefined),
    [options, value],
  );

  if (options.length === 0) return null;

  return (
    <div className={`rounded-xl border border-border/60 bg-surface p-3 ${className}`.trim()}>
      <div className="mb-2 flex items-center gap-2">
        <Filter className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span className="text-sm font-medium">{title}</span>
        {selectedOption ? (
          <VeitFieldTagBadge
            className="ml-auto max-w-[min(100%,14rem)]"
            variant="field"
            name={selectedOption.path}
            hex_color={selectedOption.hex_color}
            title={selectedOption.path}
          />
        ) : (
          <span className="ml-auto text-xs text-muted-foreground">{allLabel}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={disabled}
          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
            value == null
              ? 'border-primary bg-primary/10 font-medium text-primary'
              : 'border-border/70 text-muted-foreground hover:border-border hover:text-foreground'
          }`}
          onClick={() => onChange(null)}
        >
          {allLabel}
        </button>
        {options.map((opt) => {
          const active = value === opt.id;
          const color = tagColor({ hex_color: opt.hex_color });
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              title={opt.path}
              className={
                active
                  ? 'rounded-full border border-transparent px-2.5 py-1 text-xs font-medium text-white shadow-sm transition-colors'
                  : 'rounded-full border-2 bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted/30'
              }
              style={active ? { backgroundColor: color } : { borderColor: color }}
              onClick={() => onChange(active ? null : opt.id)}
            >
              <span className={opt.depth > 0 ? 'opacity-90' : undefined}>{opt.path}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
