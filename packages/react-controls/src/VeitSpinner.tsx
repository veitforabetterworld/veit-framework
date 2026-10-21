import { createContext, useContext, type ReactNode } from 'react';

export type VeitSpinnerSize = 'sm' | 'md' | 'lg';

/** Host-eigene Marke. Das Framework liefert Status, Größe und die Scan-Bewegung. */
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

const TRACK = {
  sm: 'h-4 w-10',
  md: 'h-6 w-14',
  lg: 'h-8 w-20',
} as const;

function DefaultMark({ size }: { size: VeitSpinnerSize }) {
  return (
    <span className={`relative inline-block overflow-hidden rounded-sm bg-muted ${TRACK[size]}`} aria-hidden>
      <span className="absolute inset-x-0 top-0.5 h-0.5 animate-veit-scan rounded-full bg-primary motion-reduce:top-1/2 motion-reduce:animate-none" />
    </span>
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
      {mark ? mark({ size }) : <DefaultMark size={size} />}
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  );
}
