import type { ReactNode } from 'react';

import { VeitPageHeader } from './VeitPageHeader.js';

export type VeitPageWidth = 'narrow' | 'default' | 'wide' | 'full';

const WIDTH: Record<VeitPageWidth, string> = {
  narrow: 'max-w-3xl',
  default: 'max-w-6xl',
  wide: 'max-w-7xl',
  full: '',
};

export type VeitPageProps = {
  /** With a title, the page starts with a VeitPageHeader. */
  title?: string;
  description?: string;
  /** Buttons on the right of the header. */
  actions?: ReactNode;
  /** In front of the title, e.g. a back button. */
  leading?: ReactNode;
  width?: VeitPageWidth;
  className?: string;
  children?: ReactNode;
};

/** Page container: centred column with the usual padding and gaps, optionally with a header. */
export function VeitPage({ title, description, actions, leading, width = 'default', className = '', children }: VeitPageProps) {
  return (
    <div className={`mx-auto flex w-full min-w-0 flex-col gap-6 p-4 sm:p-6 ${WIDTH[width]} ${className}`.trim()}>
      {title ? <VeitPageHeader title={title} subtitle={description} leading={leading} trailing={actions} /> : null}
      {children}
    </div>
  );
}
