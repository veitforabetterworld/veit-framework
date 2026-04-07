# @veit/react-dnd

Veit building blocks for **@dnd-kit** in React:

- **Constants** — `VEIT_DND_POINTER_DISTANCE`, touch delay/tolerance, `VEIT_DRAG_SURFACE_TOUCH_CLASS`
- **Tailwind surface helpers** — `veitSortableSurfaceClassName`, `veitSortableDragBindings`, `veitSortableExcludeFromDragProps`
- **Sensors** — `useVeitDndSensors`
- **Context** — `VeitDndContext` (default sensors)
- **Lists** — `VeitSortableVerticalList`
- **Droppables** — `VeitDroppableColumn`
- **Collision** — `createVeitNestedBoardCollisionDetection` for nested parent/child/column boards

**Peer dependencies:** `react`, `react-dom`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

**Theming:** Class-based helpers assume a Tailwind setup with semantic tokens (`ring-ring`, `bg-muted`, …). This package ships no global CSS.
