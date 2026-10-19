import type { ReactNode } from 'react';

export type VeitDescriptionListProps = {
  children: ReactNode;
  className?: string;
};

export function VeitDescriptionList({ children, className = '' }: VeitDescriptionListProps) {
  return <dl className={`grid gap-2 ${className}`.trim()}>{children}</dl>;
}

export type VeitDescriptionRowProps = {
  label: ReactNode;
  value: ReactNode;
  className?: string;
};

export function VeitDescriptionRow({ label, value, className = '' }: VeitDescriptionRowProps) {
  return (
    <div className={`grid grid-cols-[minmax(7rem,38%)_1fr] gap-2 text-sm ${className}`.trim()}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 text-foreground">{value}</dd>
    </div>
  );
}
