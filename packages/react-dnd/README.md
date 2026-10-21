# @veit/react-dnd



Veit building blocks for **@dnd-kit** in React:



- **Constants** — `VEIT_DND_POINTER_DISTANCE`, touch delay/tolerance, `VEIT_DRAG_SURFACE_TOUCH_CLASS`

- **Tailwind surface helpers** — `veitSortableSurfaceClassName`, `veitSortableDragBindings`, `veitSortableExcludeFromDragProps`

- **Sensors and root** stay inside `VeitSortableVerticalList`, `VeitSortableHorizontalList`, `VeitSortableGrid` and `VeitNestedBoardDndShell`. Hosts do not import the context or `@dnd-kit` helpers from this package.



## Region vs presets



- **`VeitSortableRegion`** — only `SortableContext` + `strategy` + `items`. Use under `VeitNestedBoardDndShell` so you do not open a second DnD root.

- **Presets** (each opens one drag root and a sortable region):

  - **`VeitSortableVerticalList`** — vertical reorder

  - **`VeitSortableHorizontalList`** — horizontal reorder

  - **`VeitSortableGrid`** — grid reorder

  - **`VeitNestedBoardDndShell`** — nested board. Pass `veitKanbanNestedBoardCollision` (`list-*` / `card-*`) or a host config from `createVeitNestedBoardCollisionDetection`.



**Decision tree:** One sortable surface? → list, horizontal list or grid. Nested board? → `VeitNestedBoardDndShell`. Already inside that shell? → only `VeitSortableRegion`.



## Sortable rows (handle vs whole row)



- **`useVeitSortableItem`** — `useSortable` + `CSS.Transform` + `rowStyle`; optional `draggingOpacity`. Lowest-level hook when you build a fully custom row.

- **`VeitSortableRow`** — renders **`renderDragHandle`** first, then **`children`** as **siblings** on the same root (`as` = `div` | `li` | `tr`). Use when the handle sits beside the row content at the root.

- **`VeitSortableSlotRow`** — same sortable root + `rowStyle`, but **`children` is a function `(dragHandle) => ReactNode`** so the handle is placed **inside** nested markup (e.g. card + flex header). Optional **`activeDragId`** matches **`id`** (string-wise) to dim the row while a `DragOverlay` shows this item. Prefer this over page-local wrappers for nested vertical lists.



**Only the handle draggable:** put `attributes`/`listeners` only on the handle via `veitSortableDragBindings` (and `veitSortableExcludeFromDragProps` on buttons inside the row). **Whole row surface:** spread bindings on the row root and use `veitSortableSurfaceClassName`.



## Droppables & nested board collision



- **`VeitDroppableColumn`** — `useDroppable` with `col-${id}` (prefix configurable)

- **`createVeitNestedBoardCollisionDetection`** — parent/child/column collision for nested boards



## Nested board overlay drop animation



`DragOverlay` animates to the **source** draggable by default. For nested boards, the source node may still sit in the old column; use a drop animation that targets the **current droppable** (`over`):



1. Keep `overIdRef` in sync with **`onDragOver`** via **`useVeitNestedBoardDragOverTarget`** (clear on `onDragCancel` / drag start).

2. On **`onDragEnd`**, set `overIdRef.current` to the final `e.over?.id` **before** async work if your flow clears state early — the animation reads the ref when the drop animation runs.

3. Pass **`createVeitNestedBoardDropAnimation(() => overIdRef.current)`** via `nestedDropAnimation` on **`VeitNestedBoardDndShell`**. The shell owns the overlay.



Lower-level helpers: **`resolveVeitNestedBoardDropTargetRect`** (rect from `droppableContainers`), **`createVeitNestedBoardDropAnimation`** (duration/easing/active opacity configurable).



**Peer dependencies:** `react`, `react-dom`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.



**Theming:** Class-based helpers assume a Tailwind setup with semantic tokens (`ring-ring`, `bg-muted`, …). This package ships no global CSS.

