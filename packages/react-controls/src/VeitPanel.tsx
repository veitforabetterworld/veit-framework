import type { ReactNode } from 'react';

export type VeitPanelProps = {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'aside' | 'ul' | 'li';
};

export function VeitPanel({ children, className = '', as: Tag = 'section' }: VeitPanelProps) {
  return <Tag className={`card ${className}`.trim()}>{children}</Tag>;
}
