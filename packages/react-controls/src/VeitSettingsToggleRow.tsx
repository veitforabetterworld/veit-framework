import { useId, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { VeitSwitch } from './VeitSwitch.js';

export type VeitSettingsToggleRowProps = {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  /** If set: clicking the label calls this only (no toggle). Only the switch toggles. */
  onLabelClick?: () => void;
  /** `embed`: no outer card; for embedding in existing rows. */
  variant?: 'card' | 'embed';
  /** Extra controls between label and switch (e.g. settings icon). */
  trailing?: ReactNode;
  title?: string;
  className?: string;
  switchClassName?: string;
  id?: string;
};

export function VeitSettingsToggleRow({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  onLabelClick,
  variant = 'card',
  trailing,
  title,
  className = '',
  switchClassName,
  id: idProp,
}: VeitSettingsToggleRowProps) {
  const uid = useId();
  const baseId = idProp ?? uid.replace(/:/g, '');
  const labelId = `${baseId}-label`;
  const descId = `${baseId}-desc`;
  const switchId = `${baseId}-switch`;

  const shellClass =
    variant === 'embed'
      ? 'flex items-center gap-3'
      : 'flex items-center gap-3 rounded-lg border border-border/60 bg-card/30 px-3 py-2.5';

  const handleLabelAreaClick = (e: MouseEvent) => {
    if (disabled) return;
    const t = e.target as HTMLElement;
    if (t.closest('a')) return;
    if (onLabelClick) {
      onLabelClick();
      return;
    }
    onCheckedChange(!checked);
  };

  const handleLabelKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target as HTMLElement;
    if (t.closest('a')) return;
    e.preventDefault();
    if (onLabelClick) {
      onLabelClick();
      return;
    }
    onCheckedChange(!checked);
  };

  return (
    <div className={shellClass + (className ? ` ${className}` : '')} title={title}>
      <div
        id={labelId}
        className={
          'min-w-0 flex-1 text-left text-sm leading-snug text-foreground outline-none ' +
          (disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')
        }
        onClick={handleLabelAreaClick}
        onKeyDown={handleLabelKeyDown}
        role="button"
        tabIndex={disabled ? undefined : 0}
      >
        <div className="font-medium">{label}</div>
        {description ? (
          <div id={descId} className="mt-0.5 text-xs font-normal text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {trailing != null ? <div className="flex shrink-0 items-center gap-1">{trailing}</div> : null}
      <VeitSwitch
        id={switchId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-labelledby={labelId}
        aria-describedby={description ? descId : undefined}
        className={switchClassName}
      />
    </div>
  );
}
