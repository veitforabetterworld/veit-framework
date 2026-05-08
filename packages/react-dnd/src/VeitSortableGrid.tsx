import type { ReactNode } from 'react';
import type { UniqueIdentifier } from '@dnd-kit/core';
import type { DndContextProps } from '@dnd-kit/core';
import { rectSortingStrategy } from '@dnd-kit/sortable';
import { VeitDndContext } from './VeitDndContext.js';
import { VeitSortableRegion } from './VeitSortableRegion.js';

export type VeitSortableGridProps = Omit<DndContextProps, 'sensors' | 'children'> & {
  sortableIds: UniqueIdentifier[];
  sortableChildren: ReactNode;
  beforeSortable?: ReactNode;
  afterSortable?: ReactNode;
};

/** Grid / rect sortable surface + `VeitDndContext` (admin tiles, raster UIs). */
export function VeitSortableGrid({
  sortableIds,
  sortableChildren,
  beforeSortable,
  afterSortable,
  ...dndProps
}: VeitSortableGridProps) {
  return (
    <VeitDndContext {...dndProps}>
      {beforeSortable}
      <VeitSortableRegion items={sortableIds} strategy={rectSortingStrategy}>
        {sortableChildren}
      </VeitSortableRegion>
      {afterSortable}
    </VeitDndContext>
  );
}
