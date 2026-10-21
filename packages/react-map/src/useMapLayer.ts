import type { Map as MapLibreMap } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { useMap } from './MapContext.js';

/**
 * Runs `ensure` once the style is loaded and after every later style load.
 * `ensure` must be safe to repeat. The latest function is called; it is not a dependency.
 * Image sources and custom layers do not survive a style swap, so they belong here.
 */
export function useMapLayer(ensure: (map: MapLibreMap) => void): void {
  const map = useMap();
  const ref = useRef(ensure);
  ref.current = ensure;
  useEffect(() => {
    const run = () => {
      if (!map.getStyle()) return;
      ref.current(map);
    };
    // `isStyleLoaded()` stays false after `style.load` while terrain or projection is still settling.
    // The style document is enough: host layers can be added as soon as it exists.
    if (map.getStyle()) run();
    map.on('style.load', run);
    return () => {
      map.off('style.load', run);
    };
  }, [map]);
}
