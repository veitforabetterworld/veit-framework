import { type CSSProperties, createElement, type ReactNode } from 'react';
import type { UniqueIdentifier } from '@dnd-kit/core';
import type { UseVeitSortableItemOptions } from './useVeitSortableItem.js';
import { useVeitSortableItem } from './useVeitSortableItem.js';
import { veitSortableDragBindings, veitSortableSurfaceClassName } from './veitSortableSurface.js';

export type VeitSortableSurfaceItemAs = 'div' | 'li' | 'th' | 'tr';

export type VeitSortableSurfaceItemProps = UseVeitSortableItemOptions & {
  id: UniqueIdentifier;
  as?: VeitSortableSurfaceItemAs;
  className?: string;
  style?: CSSProperties;
  /** Z. B. Tooltip für die ganze sortierbare Fläche. */
  title?: string;
  /** Zusätzliche Klassen nur während `isDragging` (z. B. Ring). */
  draggingClassName?: string;
  children?: ReactNode;
};

/**
 * Gesamte Fläche des Wurzelelements ist Griff (Sortable-`listeners` auf dem Root).
 * Für getrennten Griff / „Split“-Layouts: {@link VeitSortableSplitItem}.
 */
export function VeitSortableSurfaceItem({
  id,
  as = 'div',
  className = '',
  style,
  title,
  draggingClassName,
  children,
  disabled = false,
  ...itemOptions
}: VeitSortableSurfaceItemProps) {
  const { setNodeRef, rowStyle, attributes, listeners, isDragging } = useVeitSortableItem(id, {
    disabled,
    ...itemOptions,
  });
  const surfaceCn = veitSortableSurfaceClassName(!!disabled);
  const mergedClass = [className, surfaceCn, isDragging && draggingClassName ? draggingClassName : '']
    .filter(Boolean)
    .join(' ')
    .trim();
  return createElement(
    as,
    {
      ref: setNodeRef,
      style: { ...rowStyle, ...style },
      className: mergedClass || undefined,
      title,
      ...veitSortableDragBindings({ attributes, listeners }, !!disabled),
    },
    children,
  );
}
