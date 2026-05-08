import { createElement, type CSSProperties, type ReactNode, type Ref } from 'react';
import type { UniqueIdentifier } from '@dnd-kit/core';
import type { UseVeitSortableItemOptions } from './useVeitSortableItem.js';
import { useVeitSortableItem } from './useVeitSortableItem.js';

export type VeitSortableActivatorRenderProps = {
  setActivatorNodeRef: (node: HTMLElement | null) => void;
  listeners: Record<string, unknown> | undefined;
};

export type VeitSortableActivatorRowProps = Omit<UseVeitSortableItemOptions, 'id'> & {
  id: UniqueIdentifier;
  as?: 'li' | 'div';
  className?: string;
  style?: CSSProperties;
  renderActivator: (p: VeitSortableActivatorRenderProps) => ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
};

/**
 * Sortierbare Zeile mit separatem Aktivator (`setActivatorNodeRef` + `listeners` am Griff),
 * Sortable-`attributes` am Wurzelelement (wie @dnd-kit-Dokumentation).
 */
export function VeitSortableActivatorRow({
  id,
  as = 'li',
  className = '',
  style,
  renderActivator,
  children,
  trailing,
  ...itemOptions
}: VeitSortableActivatorRowProps) {
  const sortable = useVeitSortableItem(id, itemOptions);
  const { setNodeRef, rowStyle, attributes, listeners, setActivatorNodeRef } = sortable;

  const inner = (
    <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex shrink-0 items-start sm:items-center">
        {renderActivator({ setActivatorNodeRef, listeners })}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
      {trailing != null ? <div className="flex shrink-0 items-end sm:items-center">{trailing}</div> : null}
    </div>
  );

  return createElement(as, {
    ref: setNodeRef as Ref<HTMLLIElement & HTMLDivElement>,
    style: { ...rowStyle, ...style },
    className,
    ...attributes,
  }, inner);
}
