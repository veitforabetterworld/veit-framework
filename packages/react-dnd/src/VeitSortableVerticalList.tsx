import type { ReactNode } from 'react';
import type { UniqueIdentifier } from '@dnd-kit/core';
import type { DndContextProps } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { VeitDndContext } from './VeitDndContext.js';

export type VeitSortableVerticalListProps = Omit<DndContextProps, 'sensors' | 'children'> & {
  sortableIds: UniqueIdentifier[];
  /** Content inside `SortableContext` (e.g. `<ul>…</ul>`). */
  sortableChildren: ReactNode;
  /** Optional hints/errors above the sortable list. */
  beforeSortable?: ReactNode;
  /** Optional `DragOverlay` etc. as sibling after `SortableContext`. */
  afterSortable?: ReactNode;
};

/**
 * Vertical sortable list with a shared `VeitDndContext` — simple reorder UIs.
 * Complex boards can use `VeitDndContext` directly.
 */
export function VeitSortableVerticalList({
  sortableIds,
  sortableChildren,
  beforeSortable,
  afterSortable,
  ...dndProps
}: VeitSortableVerticalListProps) {
  return (
    <VeitDndContext {...dndProps}>
      {beforeSortable}
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        {sortableChildren}
      </SortableContext>
      {afterSortable}
    </VeitDndContext>
  );
}
