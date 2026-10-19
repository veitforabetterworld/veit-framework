import type { InputHTMLAttributes } from 'react';

export type VeitRangeProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: number;
  min?: number;
  max?: number;
  onValueChange: (value: number) => void;
};

/** Bereichsregler. Die Füllung kommt aus dem Wert, die Farbe aus `--primary`. */
export function VeitRange({ value, min = 0, max = 100, onValueChange, className = '', ...rest }: VeitRangeProps) {
  const span = max - min || 1;
  const fill = Math.min(100, Math.max(0, ((value - min) / span) * 100));
  return (
    <input
      type="range"
      className={`veit-range ${className}`.trim()}
      min={min}
      max={max}
      value={value}
      onChange={(event) => onValueChange(Number(event.target.value))}
      style={{ ['--slider-fill' as string]: `${fill}%` }}
      {...rest}
    />
  );
}
