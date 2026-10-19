import * as Switch from '@radix-ui/react-switch';

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
    <Switch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-labelledby={ariaLabelledby}
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={
        'inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-border/80 p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 data-[state=checked]:border-primary/40 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted ' +
        className
      }
    >
      <Switch.Thumb className="block h-5 w-5 rounded-full bg-background shadow transition-transform data-[state=checked]:translate-x-5" />
    </Switch.Root>
  );
}
