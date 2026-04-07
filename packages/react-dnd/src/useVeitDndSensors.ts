import { KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  VEIT_DND_POINTER_DISTANCE,
  VEIT_DND_TOUCH_DELAY_MS,
  VEIT_DND_TOUCH_TOLERANCE_PX,
} from './constants.js';

export type VeitDndSensorOptions = {
  pointerDistance?: number;
  touchDelayMs?: number;
  touchTolerancePx?: number;
};

/**
 * Default sensors: pointer, touch (hold delay), keyboard (sortable arrow keys).
 */
export function useVeitDndSensors(options?: VeitDndSensorOptions) {
  const pointerDistance = options?.pointerDistance ?? VEIT_DND_POINTER_DISTANCE;
  const touchDelayMs = options?.touchDelayMs ?? VEIT_DND_TOUCH_DELAY_MS;
  const touchTolerancePx = options?.touchTolerancePx ?? VEIT_DND_TOUCH_TOLERANCE_PX;

  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: pointerDistance } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: touchDelayMs, tolerance: touchTolerancePx },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}
