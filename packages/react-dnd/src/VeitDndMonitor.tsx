import { useDndMonitor, type DndMonitorArguments } from '@dnd-kit/core';

export type VeitDndMonitorProps = DndMonitorArguments;

/** Deklarative Hülle um `useDndMonitor` (global drop highlight, Telemetry, …). */
export function VeitDndMonitor(props: VeitDndMonitorProps) {
  useDndMonitor(props);
  return null;
}
