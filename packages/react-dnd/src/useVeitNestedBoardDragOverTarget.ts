import { useCallback, useRef, type MutableRefObject } from 'react';
import type { DragOverEvent } from '@dnd-kit/core';

export type VeitNestedBoardDragOverTarget = {
  /** Latest `over.id` from `onDragOver`; `null` if none. */
  overIdRef: MutableRefObject<string | null>;
  onDragOver: (e: DragOverEvent) => void;
  resetOverId: () => void;
};

/**
 * Keeps a ref in sync with the current drop target for nested-board `DragOverlay` animations.
 * Wire `onDragOver` to `VeitDndContext`. Use `resetOverId` on `onDragCancel` and at drag start.
 * On `onDragEnd`, if the drop animation reads this ref, set `overIdRef.current` to the final `over.id`
 * before other teardown (see README / Kanban pattern).
 */
export function useVeitNestedBoardDragOverTarget(): VeitNestedBoardDragOverTarget {
  const overIdRef = useRef<string | null>(null);

  const onDragOver = useCallback((e: DragOverEvent) => {
    overIdRef.current = e.over != null ? String(e.over.id) : null;
  }, []);

  const resetOverId = useCallback(() => {
    overIdRef.current = null;
  }, []);

  return { overIdRef, onDragOver, resetOverId };
}
