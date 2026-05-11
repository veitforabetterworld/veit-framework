/** Minimum pointer movement (px) before a mouse/stylus drag starts (avoids accidental drags). */
export const VEIT_DND_POINTER_DISTANCE = 8;

/** Touch: short hold (ms) before drag; distinguishes drag from scroll (slightly above „tap“ reaction). */
export const VEIT_DND_TOUCH_DELAY_MS = 280;

/** Touch: allowed finger movement (px) during the hold phase. */
export const VEIT_DND_TOUCH_TOLERANCE_PX = 8;

/**
 * Auf Drag-Flächen mit dnd-kit-`listeners` (via {@link veitSortableSurfaceClassName}).
 * `touch-manipulation` lässt vertikales/horizontales Pan für verschachtelte Scroll-Areas zu
 * (`touch-none` blockiert natives Scrollen unter dem Finger, z. B. Kanban-Spalten).
 * Touch-Drag bleiben über {@link useVeitDndSensors} TouchSensor (`delay` / `tolerance`) gekoppelt.
 */
export const VEIT_DRAG_SURFACE_TOUCH_CLASS = 'touch-manipulation';
