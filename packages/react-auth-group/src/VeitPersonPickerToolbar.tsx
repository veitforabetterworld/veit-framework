import type { ReactNode } from 'react';

export type VeitPersonPickerToolbarProps = {
  /** Linker Bereich (z.B. Modus-Select oder Überschrift); optional. */
  leading?: ReactNode;
  /** Rechte Icon-Aktionen (z.B. User+, QR, Einladen); optional. */
  trailing?: ReactNode;
  /**
   * `true`: Zeile wie bei Auth-Gruppen (`max-w-md`).
   * `false`: volle Breite; ohne `leading` richtet sich `trailing` nach rechts (`ml-auto`).
   */
  compact?: boolean;
  /** Titel links und Buttons rechts optisch oben ausrichten (z.B. mehrzeilige Überschrift). */
  alignStart?: boolean;
  className?: string;
};

/**
 * Eine Zeile über der Personen-Chip-Liste: optional links (Dropdown/Titel), rechts Icon-Buttons.
 */
export function VeitPersonPickerToolbar({
  leading,
  trailing,
  compact = false,
  alignStart = false,
  className = '',
}: VeitPersonPickerToolbarProps) {
  const align = alignStart ? 'items-start' : 'items-center';
  const row = compact
    ? `flex max-w-md gap-2 ${align}`
    : `flex w-full min-w-0 gap-2 ${align} ${leading ? '' : 'justify-end'}`.trim();
  return (
    <div className={`${row} ${className}`.trim()}>
      {leading != null ? <div className="min-w-0 flex-1">{leading}</div> : null}
      {trailing != null ? (
        <div className={`flex shrink-0 flex-wrap gap-2 ${leading != null ? '' : 'ml-auto'}`.trim()}>{trailing}</div>
      ) : null}
    </div>
  );
}
