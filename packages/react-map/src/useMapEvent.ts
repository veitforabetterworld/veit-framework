import type { Map as MapLibreMap } from 'maplibre-gl';
import { useEffect, useRef } from 'react';

/** Subscribes to a MapLibre event for the lifetime of the component. The handler may change freely. */
export function useMapEvent(
  map: MapLibreMap | null,
  type: string,
  handler: (event: unknown) => void,
): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!map) return;
    const listener = (event: unknown) => ref.current(event);
    map.on(type as 'move', listener);
    return () => {
      map.off(type as 'move', listener);
    };
  }, [map, type]);
}
