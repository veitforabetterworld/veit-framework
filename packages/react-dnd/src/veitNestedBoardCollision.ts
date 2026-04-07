import {
  closestCenter,
  closestCorners,
  pointerWithin,
  type CollisionDetection,
} from '@dnd-kit/core';

/**
 * Config for nested boards: outer sortables (columns/sections/layers),
 * inner sortables (cards/tools/elements), and optional column droppables (`col-*`).
 */
export type VeitNestedBoardCollisionConfig = {
  parentPrefix: string;
  childPrefix: string;
  /** Default `col-` — inner column/area for drops. */
  columnPrefix?: string;
  /** Algorithm for dragging parent items (e.g. horizontal Kanban: closestCenter). */
  parentListStrategy: 'closestCenter' | 'closestCorners';
  /**
   * When dragging a parent: remove active item from collision set.
   * Helps e.g. org sections with only two items.
   */
  excludeActiveFromParentContainers?: boolean;
  /** When dragging a child: remove active item from collision set. */
  excludeActiveFromChildContainers?: boolean;
  /**
   * With `pointerWithin`: prefer hits with `childPrefix` over plain column hits (Kanban cards).
   */
  preferChildHitInPointerWithin?: boolean;
  /**
   * When dragging children: extra valid droppable id prefixes (e.g. `layer-` in map layers).
   */
  childCollisionExtraPrefixes?: string[];
};

/**
 * Factory for @dnd-kit `collisionDetection` with parent+child+column droppables.
 */
export function createVeitNestedBoardCollisionDetection(
  config: VeitNestedBoardCollisionConfig
): CollisionDetection {
  const columnPrefix = config.columnPrefix ?? 'col-';

  return (args) => {
    const activeId = String(args.active.id);
    const {
      parentPrefix,
      childPrefix,
      parentListStrategy,
      excludeActiveFromParentContainers,
      excludeActiveFromChildContainers,
      preferChildHitInPointerWithin,
      childCollisionExtraPrefixes,
    } = config;

    if (activeId.startsWith(parentPrefix)) {
      let onlyParents = args.droppableContainers.filter((c) => String(c.id).startsWith(parentPrefix));
      if (excludeActiveFromParentContainers) {
        onlyParents = onlyParents.filter((c) => String(c.id) !== activeId);
      }
      if (onlyParents.length === 0) {
        return excludeActiveFromParentContainers ? [] : closestCorners(args);
      }
      const scoped = { ...args, droppableContainers: onlyParents };
      return parentListStrategy === 'closestCenter' ? closestCenter(scoped) : closestCorners(scoped);
    }

    if (activeId.startsWith(childPrefix)) {
      const inner = args.droppableContainers.filter((c) => {
        const id = String(c.id);
        if (excludeActiveFromChildContainers && id === activeId) return false;
        if (id.startsWith(childPrefix) || id.startsWith(columnPrefix)) return true;
        return childCollisionExtraPrefixes?.some((p) => id.startsWith(p)) ?? false;
      });
      if (inner.length === 0) return closestCorners(args);
      const scoped = { ...args, droppableContainers: inner };
      const pointerHits = pointerWithin(scoped);
      if (pointerHits.length > 0) {
        if (preferChildHitInPointerWithin) {
          const overChild = pointerHits.filter((h) => String(h.id).startsWith(childPrefix));
          if (overChild.length > 0) return overChild;
          const overCol = pointerHits.filter((h) => String(h.id).startsWith(columnPrefix));
          if (overCol.length > 0) return overCol;
          for (const p of childCollisionExtraPrefixes ?? []) {
            const hit = pointerHits.filter((h) => String(h.id).startsWith(p));
            if (hit.length > 0) return hit;
          }
        }
        return pointerHits;
      }
      return closestCorners(scoped);
    }

    return closestCorners(args);
  };
}
