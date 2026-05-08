/** Minimum pointer movement (px) before a mouse/stylus drag starts (avoids accidental drags). */
export const VEIT_DND_POINTER_DISTANCE = 8;

/** Touch: short hold (ms) before drag; distinguishes drag from scroll (slightly above „tap“ reaction). */
export const VEIT_DND_TOUCH_DELAY_MS = 280;

/** Touch: allowed finger movement (px) during the hold phase. */
export const VEIT_DND_TOUCH_TOLERANCE_PX = 8;

/**
 * Use on drag surfaces with dnd-kit `listeners` so mobile browsers do not treat the gesture as scroll.
 * Typically composed into Tailwind via {@link veitSortableSurfaceClassName}.
 */
export const VEIT_DRAG_SURFACE_TOUCH_CLASS = 'touch-none';
