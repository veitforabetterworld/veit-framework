import { DndContext, type DndContextProps } from '@dnd-kit/core';
import { useVeitDndSensors } from './useVeitDndSensors.js';

export type VeitDndContextProps = DndContextProps;

/**
 * Same as `DndContext` with default sensors (pointer + touch + keyboard for sortable).
 * Pass `sensors` to override.
 */
export function VeitDndContext({ sensors, ...rest }: VeitDndContextProps) {
  const defaultSensors = useVeitDndSensors();
  return <DndContext sensors={sensors ?? defaultSensors} {...rest} />;
}
