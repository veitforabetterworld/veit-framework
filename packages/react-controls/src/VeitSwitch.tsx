export type VeitSwitchProps = {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
  id?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-label'?: string;
  className?: string;
};

export function VeitSwitch({
  checked,
  onCheckedChange,
  disabled,
  id,
  'aria-labelledby': ariaLabelledby,
  'aria-describedby': ariaDescribedby,
  'aria-label': ariaLabel,
  className = '',
}: VeitSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-labelledby={ariaLabelledby}
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={
        'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border border-border/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 dark:[&>span]:ring-white/10 ' +
        (checked ? 'border-primary/40 bg-primary' : 'bg-muted') +
        (className ? ` ${className}` : '')
      }
    >
      <span
        aria-hidden
        className={
          'pointer-events-none absolute top-0.5 h-5 w-5 rounded-full bg-primary-foreground shadow-sm ring-1 ring-black/5 transition-transform motion-reduce:transition-none ' +
          (checked ? 'left-0.5 translate-x-6' : 'left-0.5 translate-x-0')
        }
      />
    </button>
  );
}
