import { useId, useRef, type KeyboardEvent } from 'react';
import { Check, Pipette } from 'lucide-react';

/** A calm default palette (Tailwind 600 tones); hosts pass their own brand colours. */
export const VEIT_COLOR_SWATCHES: readonly string[] = [
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0d9488',
  '#0284c7',
  '#2563eb',
  '#7c3aed',
  '#c026d3',
  '#475569',
];

/** '#rrggbb' in lower case for '#rgb', '#rrggbb' or the same without '#'; null for anything else. */
export function normalizeHexColor(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{6}$/.test(raw)) return `#${raw}`;
  if (/^[0-9a-f]{3}$/.test(raw)) return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
  return null;
}

export type VeitColorInputProps = {
  /** Goes on the native colour input, so `<VeitField htmlFor>` labels it. */
  id?: string;
  /** Hex colour ('#rrggbb'); anything else selects no swatch and opens the picker on black. */
  value: string;
  /** Always '#rrggbb' in lower case. */
  onChange: (hex: string) => void;
  /** Colours to pick with one click; default VEIT_COLOR_SWATCHES, [] shows only the picker. */
  swatches?: readonly string[];
  /** Name of the swatch group for screen readers (e.g. the field label). */
  label: string;
  /** Name of the own-colour button ("Eigene Farbe"). */
  customLabel: string;
  /** Name of a swatch; default the hex value. */
  swatchLabel?: (hex: string) => string;
  /** Shows the hex value next to the picker. Default true. */
  showValue?: boolean;
  disabled?: boolean;
  className?: string;
};

const SWATCH_CLASS =
  'relative inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:scale-100';

/** White or black mark on a colour, by its brightness. */
function markClass(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance > 0.6 ? 'text-black' : 'text-white';
}

/**
 * Colour field: swatches as a radio group (arrow keys move, like native radios) and an own colour through the native
 * picker inside the control, so hosts need no `<input type="color">` of their own.
 */
export function VeitColorInput({
  id,
  value,
  onChange,
  swatches = VEIT_COLOR_SWATCHES,
  label,
  customLabel,
  swatchLabel = (hex) => hex,
  showValue = true,
  disabled = false,
  className = '',
}: VeitColorInputProps) {
  const fallbackId = useId();
  const inputId = id ?? `${fallbackId}-color`;
  const current = normalizeHexColor(value);
  const palette = swatches.map((s) => normalizeHexColor(s)).filter((s): s is string => s !== null);
  const selectedIndex = current ? palette.indexOf(current) : -1;
  const custom = current !== null && selectedIndex === -1;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const pick = (hex: string) => {
    if (!disabled) onChange(hex);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0 || palette.length === 0) return;
    event.preventDefault();
    const next = (index + step + palette.length) % palette.length;
    const hex = palette[next];
    if (hex) pick(hex);
    buttons.current[next]?.focus();
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      {palette.length > 0 ? (
        <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-2">
          {palette.map((hex, index) => {
            const checked = index === selectedIndex;
            // Roving tab stop: the selected swatch, or the first one when none is selected.
            const tabbable = checked || (selectedIndex === -1 && index === 0);
            return (
              <button
                key={hex}
                ref={(el) => {
                  buttons.current[index] = el;
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={swatchLabel(hex)}
                title={swatchLabel(hex)}
                tabIndex={tabbable ? 0 : -1}
                disabled={disabled}
                className={`${SWATCH_CLASS} ${checked ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : ''}`}
                style={{ backgroundColor: hex }}
                onClick={() => pick(hex)}
                onKeyDown={(e) => onKeyDown(e, index)}
              >
                {checked ? <Check className={`size-4 ${markClass(hex)}`} aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
      {/* The native picker covers the own-colour swatch: one click opens it, the label names it. */}
      <span
        className={`${SWATCH_CLASS} overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background ${custom ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : 'bg-muted'} ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
        style={custom && current ? { backgroundColor: current } : undefined}
        title={customLabel}
      >
        <Pipette className={`pointer-events-none size-4 ${custom && current ? markClass(current) : 'text-muted-foreground'}`} aria-hidden />
        <input
          id={inputId}
          type="color"
          aria-label={customLabel}
          value={current ?? '#000000'}
          disabled={disabled}
          className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-default"
          onChange={(e) => {
            const hex = normalizeHexColor(e.target.value);
            if (hex) pick(hex);
          }}
        />
      </span>
      {showValue && current ? <code className="text-xs text-muted-foreground">{current}</code> : null}
    </div>
  );
}
