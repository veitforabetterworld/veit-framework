import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  VEIT_DND_POINTER_DISTANCE,
  VEIT_DND_TOUCH_DELAY_MS,
  VEIT_DND_TOUCH_TOLERANCE_PX,
} from './constants.js';

export type VeitDndSensorOptions = {
  /** Mindestbewegung (px) bei Maus, bevor Drag startet. */
  pointerDistance?: number;
  touchDelayMs?: number;
  touchTolerancePx?: number;
};

/**
 * Standard-Sensoren: **Maus** (Distanz), **Touch** (Halten + Toleranz → Scroll zuerst möglich),
 * **Tastatur** (Pfeiltasten für Sortable).
 *
 * Wichtig: Kein `PointerSensor` für Touch — der würde dieselben Pointer-Events wie das Scrollen
 * bedienen und Drag sofort auslösen. `MouseSensor` ignoriert Touch; dafür übernimmt
 * `TouchSensor` die Verzögerung (`delay` / `tolerance`).
 */
export function useVeitDndSensors(options?: VeitDndSensorOptions) {
  const pointerDistance = options?.pointerDistance ?? VEIT_DND_POINTER_DISTANCE;
  const touchDelayMs = options?.touchDelayMs ?? VEIT_DND_TOUCH_DELAY_MS;
  const touchTolerancePx = options?.touchTolerancePx ?? VEIT_DND_TOUCH_TOLERANCE_PX;

  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: pointerDistance } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: touchDelayMs, tolerance: touchTolerancePx },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}
