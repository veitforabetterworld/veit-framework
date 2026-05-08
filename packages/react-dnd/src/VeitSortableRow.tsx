import { createElement, type CSSProperties, type ReactNode } from 'react';
import type { UniqueIdentifier } from '@dnd-kit/core';
import type { UseVeitSortableItemOptions } from './useVeitSortableItem.js';
import { useVeitSortableItem } from './useVeitSortableItem.js';
import type { VeitSortableDragParts } from './veitSortableSurface.js';

export type VeitSortableRowRenderDragHandle = (parts: VeitSortableDragParts) => ReactNode;

export type VeitSortableRowProps = UseVeitSortableItemOptions & {
  id: UniqueIdentifier;
  /** Root tag for the sortable row (`ref` + layout). */
  as?: 'div' | 'li' | 'tr';
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** Renders the drag handle (grip, surface, …) with `attributes`/`listeners`. */
  renderDragHandle: VeitSortableRowRenderDragHandle;
};

/**
 * Opinionated row: root receives `setNodeRef` + {@link useVeitSortableItem}'s `rowStyle`;
 * handle is rendered via `renderDragHandle` before `children`.
 * For handle placement inside nested content, use {@link useVeitSortableItem} directly.
 */
export function VeitSortableRow({
  id,
  as = 'div',
  className,
  style,
  children,
  renderDragHandle,
  ...itemOptions
}: VeitSortableRowProps) {
  const { setNodeRef, rowStyle, attributes, listeners } = useVeitSortableItem(id, itemOptions);
  const handle = renderDragHandle({ attributes, listeners });

  return createElement(
    as,
    { ref: setNodeRef, className, style: { ...rowStyle, ...style } },
    handle,
    children
  );
}
