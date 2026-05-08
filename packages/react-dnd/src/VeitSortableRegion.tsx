import type { ReactNode } from 'react';
import type { UniqueIdentifier } from '@dnd-kit/core';
import { SortableContext, type SortingStrategy } from '@dnd-kit/sortable';

export type VeitSortableRegionProps = {
  items: UniqueIdentifier[];
  strategy: SortingStrategy;
  children: ReactNode;
};

/**
 * Shared `SortableContext` wrapper for nested boards (no second `DndContext`) and presets.
 */
export function VeitSortableRegion({ items, strategy, children }: VeitSortableRegionProps) {
  return (
    <SortableContext items={items} strategy={strategy}>
      {children}
    </SortableContext>
  );
}
