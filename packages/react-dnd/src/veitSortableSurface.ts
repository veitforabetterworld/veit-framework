import type { DraggableAttributes } from '@dnd-kit/core';
import { VEIT_DRAG_SURFACE_TOUCH_CLASS } from './constants.js';

/**
 * Tailwind classes for full-surface sortable dragging (with e.g. 8px pointer activation:
 * tap stays click, drag uses the whole surface).
 */
export function veitSortableSurfaceClassName(dragDisabled: boolean): string {
  if (dragDisabled) return '';
  return `cursor-grab ${VEIT_DRAG_SURFACE_TOUCH_CLASS} active:cursor-grabbing`;
}

export type VeitSortableDragParts = {
  attributes: DraggableAttributes;
  /** Listener-Map von `useSortable` / `useDraggable` (kein stabiler Export-Typ in allen @dnd-kit-Versionen). */
  listeners?: Record<string, unknown> | undefined;
};

/**
 * Spreads `attributes` + `listeners` from `useSortable` / `useDraggable` only when not disabled.
 */
export function veitSortableDragBindings(
  dnd: VeitSortableDragParts | undefined,
  sortableDisabled: boolean
): Record<string, unknown> {
  if (sortableDisabled || !dnd) return {};
  /** Explizite Einordnung: @dnd-kit `DraggableAttributes` hat keinen Index-Signatur-Index. */
  return { ...dnd.attributes, ...(dnd.listeners ?? {}) } as Record<string, unknown>;
}

/** For buttons/links beside the drag surface: prevents a drag from starting from that control. */
export const veitSortableExcludeFromDragProps = {
  onPointerDown: (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
  },
} as const;
