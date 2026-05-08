import type { ReactNode } from 'react';
import type { UniqueIdentifier } from '@dnd-kit/core';
import type { DndContextProps } from '@dnd-kit/core';
import { horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { VeitDndContext } from './VeitDndContext.js';
import { VeitSortableRegion } from './VeitSortableRegion.js';

export type VeitSortableHorizontalListProps = Omit<DndContextProps, 'sensors' | 'children'> & {
  sortableIds: UniqueIdentifier[];
  sortableChildren: ReactNode;
  beforeSortable?: ReactNode;
  afterSortable?: ReactNode;
};

/** Horizontal `SortableContext` + `VeitDndContext` (e.g. table header cells). */
export function VeitSortableHorizontalList({
  sortableIds,
  sortableChildren,
  beforeSortable,
  afterSortable,
  ...dndProps
}: VeitSortableHorizontalListProps) {
  return (
    <VeitDndContext {...dndProps}>
      {beforeSortable}
      <VeitSortableRegion items={sortableIds} strategy={horizontalListSortingStrategy}>
        {sortableChildren}
      </VeitSortableRegion>
      {afterSortable}
    </VeitDndContext>
  );
}
