import { createContext, useContext, type ReactNode } from 'react';

export type VeitSpinnerSize = 'sm' | 'md' | 'lg';

/** Host ersetzt die Marke. Ohne Provider bleibt der Ring. */
export type VeitSpinnerMark = (props: { size: VeitSpinnerSize }) => ReactNode;

const VeitSpinnerMarkContext = createContext<VeitSpinnerMark | null>(null);

export function VeitSpinnerProvider({
  mark,
  children,
}: {
  mark: VeitSpinnerMark;
  children: ReactNode;
}) {
  return <VeitSpinnerMarkContext.Provider value={mark}>{children}</VeitSpinnerMarkContext.Provider>;
}

const SIZE = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
} as const;

function RingMark({ size }: { size: VeitSpinnerSize }) {
  return (
    <span
      className={`animate-spin rounded-full border-2 border-muted border-t-primary motion-reduce:animate-none ${SIZE[size]}`}
      aria-hidden
    />
  );
}

export type VeitSpinnerProps = {
  /** Nur für Screenreader. Kein sichtbarer Text. */
  label?: string;
  size?: VeitSpinnerSize;
};

export function VeitSpinner({ label, size = 'md' }: VeitSpinnerProps) {
  const mark = useContext(VeitSpinnerMarkContext);
  return (
    <div
      className="inline-flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      {mark ? mark({ size }) : <RingMark size={size} />}
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  );
}
