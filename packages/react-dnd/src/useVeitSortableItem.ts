import type { CSSProperties } from 'react';
import type { UniqueIdentifier } from '@dnd-kit/core';
import { useSortable, type UseSortableArguments } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export type UseVeitSortableItemOptions = Omit<UseSortableArguments, 'id'> & {
  /**
   * Opacity while this item is the active sortable (`isDragging`).
   * Omit to leave opacity untouched (only transform/transition on {@link rowStyle}).
   */
  draggingOpacity?: number;
};

export type UseVeitSortableItemResult = ReturnType<typeof useVeitSortableItem>;

/**
 * `useSortable` with {@link CSS.Transform} and transition applied via {@link rowStyle}.
 * Use {@link draggingOpacity} or compose your own opacity (e.g. “dim others” via overlay id).
 */
export function useVeitSortableItem(id: UniqueIdentifier, options?: UseVeitSortableItemOptions) {
  const { draggingOpacity, ...sortableArgs } = options ?? {};
  const sortable = useSortable({ id, ...sortableArgs });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

  const rowStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(draggingOpacity !== undefined && isDragging ? { opacity: draggingOpacity } : {}),
  };

  return {
    ...sortable,
    attributes,
    listeners,
    setNodeRef,
    isDragging,
    rowStyle,
  };
}
