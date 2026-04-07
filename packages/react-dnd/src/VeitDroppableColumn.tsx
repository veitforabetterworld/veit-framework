import { type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';

export type VeitDroppableColumnProps = {
  /** Numeric or string id; droppable id is `${columnPrefix}${columnId}`. */
  columnId: string | number;
  /** Default `col-` (boards, org home, map layers). */
  columnPrefix?: string;
  children: ReactNode;
  /** Base wrapper classes (without isOver). */
  className?: string;
  /** Extra classes when `isOver`. */
  isOverClassName?: string;
};

/**
 * Registers `useDroppable` with id `col-${columnId}` (or custom prefix).
 * Visual feedback only via `className` / `isOverClassName`.
 */
export function VeitDroppableColumn({
  columnId,
  columnPrefix = 'col-',
  children,
  className = '',
  isOverClassName = '',
}: VeitDroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `${columnPrefix}${columnId}` });
  return (
    <div
      ref={setNodeRef}
      className={`${className}${isOver && isOverClassName ? ` ${isOverClassName}` : ''}`.trim()}
    >
      {children}
    </div>
  );
}
