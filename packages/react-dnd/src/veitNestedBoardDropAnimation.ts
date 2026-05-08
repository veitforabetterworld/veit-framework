import {
  defaultDropAnimationSideEffects,
  type ClientRect,
  type DropAnimation,
  type DropAnimationFunctionArguments,
  type DroppableContainers,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

export type VeitNestedBoardDropAnimationOptions = {
  /** Default 220ms */
  durationMs?: number;
  easing?: string;
  /** Applied to the active node via `defaultDropAnimationSideEffects`. Default `0.5`. */
  activeOpacity?: string;
};

/**
 * Resolves the drag-overlay target rectangle from the current `over` droppable id
 * (so the overlay animates to the column/card target, not the source draggable node).
 */
export function resolveVeitNestedBoardDropTargetRect(
  overId: string | null,
  fallback: ClientRect,
  droppableContainers: DroppableContainers,
  measure: (node: HTMLElement) => ClientRect
): ClientRect {
  if (!overId) return fallback;
  const c = droppableContainers.get(overId);
  const node = c?.node.current;
  if (!node) return fallback;
  return c.rect.current ?? measure(node);
}

/**
 * Drop animation for nested boards: overlay flies to the latest drop target rect.
 * Pass `getOverId` from a ref kept in sync with `onDragOver` / `onDragEnd` (see {@link useVeitNestedBoardDragOverTarget}).
 */
export function createVeitNestedBoardDropAnimation(
  getOverId: () => string | null,
  options?: VeitNestedBoardDropAnimationOptions
): DropAnimation {
  const durationMs = options?.durationMs ?? 220;
  const easing = options?.easing ?? 'ease';
  const activeOpacity = options?.activeOpacity ?? '0.5';

  return (args: DropAnimationFunctionArguments) => {
    const { active, dragOverlay, transform, droppableContainers, measuringConfiguration, draggableNodes } = args;
    const targetRect = resolveVeitNestedBoardDropTargetRect(
      getOverId(),
      active.rect,
      droppableContainers,
      measuringConfiguration.droppable.measure
    );
    const delta = {
      x: dragOverlay.rect.left - targetRect.left,
      y: dragOverlay.rect.top - targetRect.top,
    };
    const scale = {
      scaleX: transform.scaleX !== 1 ? (targetRect.width * transform.scaleX) / dragOverlay.rect.width : 1,
      scaleY: transform.scaleY !== 1 ? (targetRect.height * transform.scaleY) / dragOverlay.rect.height : 1,
    };
    const finalTransform = {
      x: transform.x - delta.x,
      y: transform.y - delta.y,
      ...scale,
    };
    const initialKeyframe = { transform: CSS.Transform.toString(transform) };
    const finalKeyframe = { transform: CSS.Transform.toString(finalTransform) };
    if (JSON.stringify(initialKeyframe) === JSON.stringify(finalKeyframe)) {
      return;
    }
    const sideEffects = defaultDropAnimationSideEffects({
      styles: { active: { opacity: activeOpacity } },
    });
    const cleanup = sideEffects?.({
      active,
      dragOverlay,
      draggableNodes,
      droppableContainers,
      measuringConfiguration,
    });
    const anim = dragOverlay.node.animate([initialKeyframe, finalKeyframe], {
      duration: durationMs,
      easing,
      fill: 'forwards',
    });
    return new Promise<void>((resolve) => {
      anim.onfinish = () => {
        cleanup?.();
        resolve();
      };
    });
  };
}
