import type { CSSProperties, ReactNode } from 'react';
import type { UniqueIdentifier } from '@dnd-kit/core';
import type { VeitSortableDragParts } from './veitSortableSurface.js';
import type { UseVeitSortableItemOptions } from './useVeitSortableItem.js';
import { useVeitSortableItem } from './useVeitSortableItem.js';

export type VeitSortableSplitItemRenderProps = {
  setNodeRef: (node: HTMLElement | null) => void;
  rowStyle: CSSProperties;
  isDragging: boolean;
  dragHandleParts: VeitSortableDragParts;
};

export type VeitSortableSplitItemProps = UseVeitSortableItemOptions & {
  id: UniqueIdentifier;
  children: (p: VeitSortableSplitItemRenderProps) => ReactNode;
};

/**
 * Sortable-Node mit **getrenntem** Griff: `setNodeRef`/`rowStyle` auf dem äußeren Element,
 * {@link veitSortableDragBindings}(dragHandleParts) nur auf dem Griff-Button.
 */
export function VeitSortableSplitItem({ id, children, ...itemOptions }: VeitSortableSplitItemProps) {
  const { setNodeRef, rowStyle, isDragging, attributes, listeners } = useVeitSortableItem(id, itemOptions);
  return (
    <>
      {children({
        setNodeRef,
        rowStyle,
        isDragging,
        dragHandleParts: { attributes, listeners },
      })}
    </>
  );
}
