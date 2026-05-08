import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';

export type VeitDroppableZoneProps = {
  /** Vollständige Droppable-`id` (nicht nur numerischer Teil). */
  id: string;
  children: ReactNode;
  className?: string;
  isOverClassName?: string;
};

/** Beliebiges Drop-Ziel (`useDroppable`) — z. B. `drop-${groupId}`. */
export function VeitDroppableZone({ id, className = '', isOverClassName = '', children }: VeitDroppableZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`${className}${isOver && isOverClassName ? ` ${isOverClassName}` : ''}`.trim()}
    >
      {children}
    </div>
  );
}
