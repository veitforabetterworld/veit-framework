import { useCallback, useMemo, type ReactNode } from 'react';
import type {
  DndContextProps,
  DragCancelEvent,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { DragOverlay } from '@dnd-kit/core';
import {
  createVeitNestedBoardCollisionDetection,
  type VeitNestedBoardCollisionConfig,
} from './veitNestedBoardCollision.js';
import {
  createVeitNestedBoardDropAnimation,
  type VeitNestedBoardDropAnimationOptions,
} from './veitNestedBoardDropAnimation.js';
import { useVeitNestedBoardDragOverTarget } from './useVeitNestedBoardDragOverTarget.js';
import { VeitDndContext } from './VeitDndContext.js';

export type VeitNestedBoardDndShellProps = Omit<DndContextProps, 'collisionDetection' | 'children'> & {
  /** Erzeugt `collisionDetection` via {@link createVeitNestedBoardCollisionDetection}. */
  nestedCollision?: VeitNestedBoardCollisionConfig;
  /** Überschreibt die aus `nestedCollision` abgeleitete Collision. */
  collisionDetection?: DndContextProps['collisionDetection'];
  /**
   * Drop-Animation für verschachtelte Boards (Overlay fliegt zum Ziel).
   * Standard: `true` wenn `overlay` gesetzt ist, sonst `false`.
   */
  nestedDropAnimation?: boolean;
  nestedDropAnimationOptions?: VeitNestedBoardDropAnimationOptions;
  /** Wird in `<DragOverlay dropAnimation={…}>` eingebettet (falls gesetzt). */
  overlay?: ReactNode;
  children: ReactNode;
};

/**
 * Einheitliche Hülle für verschachtelte Sortable-Boards: optionale Nested-Collision,
 * zusammengefügte Over-Ref-Updates für die Flug-Animation, optionales `DragOverlay`.
 *
 * Ersetzt das manuelle Trio `createVeitNestedBoardCollisionDetection` +
 * `useVeitNestedBoardDragOverTarget` + `createVeitNestedBoardDropAnimation` an jedem Board.
 */
export function VeitNestedBoardDndShell({
  nestedCollision,
  collisionDetection: collisionDetectionProp,
  nestedDropAnimation: nestedDropAnimationProp,
  nestedDropAnimationOptions,
  overlay,
  children,
  onDragStart: userDragStart,
  onDragOver: userDragOver,
  onDragEnd: userDragEnd,
  onDragCancel: userDragCancel,
  ...dndRest
}: VeitNestedBoardDndShellProps) {
  const animateOverlay = nestedDropAnimationProp ?? (overlay != null);
  const { overIdRef, onDragOver: syncOverRef, resetOverId } = useVeitNestedBoardDragOverTarget();

  const dropAnimation = useMemo(
    () =>
      animateOverlay
        ? createVeitNestedBoardDropAnimation(() => overIdRef.current, nestedDropAnimationOptions)
        : undefined,
    [animateOverlay, overIdRef, nestedDropAnimationOptions]
  );

  const collisionDetection =
    collisionDetectionProp ??
    (nestedCollision ? createVeitNestedBoardCollisionDetection(nestedCollision) : undefined);

  const onDragStart = useCallback(
    (e: DragStartEvent) => {
      if (animateOverlay) resetOverId();
      userDragStart?.(e);
    },
    [animateOverlay, resetOverId, userDragStart]
  );

  const onDragOver = useCallback(
    (e: DragOverEvent) => {
      if (animateOverlay) syncOverRef(e);
      userDragOver?.(e);
    },
    [animateOverlay, syncOverRef, userDragOver]
  );

  const onDragCancel = useCallback(
    (e: DragCancelEvent) => {
      if (animateOverlay) resetOverId();
      userDragCancel?.(e);
    },
    [animateOverlay, resetOverId, userDragCancel]
  );

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      if (animateOverlay) {
        overIdRef.current = e.over != null ? String(e.over.id) : null;
      }
      void userDragEnd?.(e);
    },
    [animateOverlay, overIdRef, userDragEnd]
  );

  return (
    <VeitDndContext
      {...dndRest}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      {children}
      {overlay != null && dropAnimation != null ? (
        <DragOverlay dropAnimation={dropAnimation}>{overlay}</DragOverlay>
      ) : overlay != null ? (
        <DragOverlay>{overlay}</DragOverlay>
      ) : null}
    </VeitDndContext>
  );
}
