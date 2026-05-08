import { createElement, type CSSProperties, type ReactNode } from 'react';
import type { UniqueIdentifier } from '@dnd-kit/core';
import type { UseVeitSortableItemOptions } from './useVeitSortableItem.js';
import { useVeitSortableItem } from './useVeitSortableItem.js';
import type { VeitSortableDragParts } from './veitSortableSurface.js';

export type VeitSortableSlotRowRenderDragHandle = (parts: VeitSortableDragParts) => ReactNode;

export type VeitSortableSlotRowProps = UseVeitSortableItemOptions & {
  id: UniqueIdentifier;
  as?: 'div' | 'li';
  className?: string;
  style?: CSSProperties;
  /**
   * While a `DragOverlay` shows this item as source, dim this row (same as `isDragging` opacity).
   * Compared with `id` via `String(...)`.
   */
  activeDragId?: UniqueIdentifier | null;
  /** Opacity when `isDragging` or when `activeDragId` matches this row. Default `0.92`. */
  activeOrDraggingOpacity?: number;
  renderDragHandle: VeitSortableSlotRowRenderDragHandle;
  /** Receives the handle node; place it inside your card/layout (nested vertical lists). */
  children: (dragHandle: ReactNode) => ReactNode;
};

/**
 * Sortable row where the drag handle is injected **into** child markup (via `children(handle)`),
 * unlike {@link VeitSortableRow} which renders the handle as a sibling before `children`.
 */
export function VeitSortableSlotRow({
  id,
  as = 'li',
  className,
  style,
  activeDragId,
  activeOrDraggingOpacity = 0.92,
  renderDragHandle,
  children,
  ...itemOptions
}: VeitSortableSlotRowProps) {
  const { setNodeRef, attributes, listeners, isDragging, rowStyle } = useVeitSortableItem(id, itemOptions);
  const dimmed =
    isDragging || (activeDragId != null && String(activeDragId) === String(id));
  const mergedStyle: CSSProperties = {
    ...rowStyle,
    ...(dimmed ? { opacity: activeOrDraggingOpacity } : {}),
    ...style,
  };
  const handle = renderDragHandle({ attributes, listeners });
  return createElement(as, { ref: setNodeRef, className, style: mergedStyle }, children(handle));
}
