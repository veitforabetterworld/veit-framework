import type {
  FillLayerSpecification,
  GeoJSONSource,
  LineLayerSpecification,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  MapMouseEvent,
} from 'maplibre-gl';
import * as maplibregl from 'maplibre-gl';
import { Children, isValidElement, useEffect, useId, useRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useMap } from './MapContext.js';
import { useMapEvent } from './useMapEvent.js';
import { useMapLayer } from './useMapLayer.js';

/** Longitude first, matching MapLibre. */
export type VeitLngLat = { lng: number; lat: number };

export type VeitLngLatInput = VeitLngLat | readonly [lng: number, lat: number];

export type VeitPaint = {
  color?: string;
  fillColor?: string;
  fillOpacity?: number;
  weight?: number;
  opacity?: number;
  dashArray?: readonly number[];
};

export type VeitMapPointerEvent = {
  lngLat: VeitLngLat;
  originalEvent: MouseEvent | TouchEvent | PointerEvent;
};

export function veitLngLat(position: VeitLngLatInput): VeitLngLat {
  if ('lng' in position) return position;
  return { lng: position[0], lat: position[1] };
}

export function veitLngLatPair(position: VeitLngLatInput): [number, number] {
  const point = veitLngLat(position);
  return [point.lng, point.lat];
}

/** Pulls `{ lng, lat }` off a MapLibre mouse or layer event. No `LatLng` class. */
export function veitLngLatFromEvent(event: { lngLat: { lng: number; lat: number } }): VeitLngLat {
  return { lng: event.lngLat.lng, lat: event.lngLat.lat };
}

type MapPointerHandlers = {
  onClick?: (event: VeitMapPointerEvent) => void;
  onHover?: (event: VeitMapPointerEvent) => void;
  onLeave?: () => void;
};

/**
 * Map-level click and hover. Layer hits use the `onClick` / `onHover` props on the shape components.
 */
export function useVeitMapPointer(handlers: MapPointerHandlers): void {
  const map = useMap();
  const ref = useRef(handlers);
  ref.current = handlers;
  useMapEvent(map, 'click', (event) => {
    const mouse = event as MapMouseEvent;
    ref.current.onClick?.({
      lngLat: veitLngLatFromEvent(mouse),
      originalEvent: mouse.originalEvent,
    });
  });
  useMapEvent(map, 'mousemove', (event) => {
    const mouse = event as MapMouseEvent;
    ref.current.onHover?.({
      lngLat: veitLngLatFromEvent(mouse),
      originalEvent: mouse.originalEvent,
    });
  });
}

function pointerEvent(event: MapLayerMouseEvent): VeitMapPointerEvent {
  return { lngLat: veitLngLatFromEvent(event), originalEvent: event.originalEvent };
}

type LngLatPair = [number, number];

type VeitLineFeature = {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: { type: 'LineString'; coordinates: LngLatPair[] };
};

type VeitPolygonFeature = {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: { type: 'Polygon'; coordinates: LngLatPair[][] };
};

type VeitGeoFeatureData = VeitLineFeature | VeitPolygonFeature;

type GeoJsonData = Parameters<GeoJSONSource['setData']>[0];

function linePaint(paint: VeitPaint): NonNullable<LineLayerSpecification['paint']> {
  return {
    'line-color': paint.color ?? '#2563eb',
    'line-width': paint.weight ?? 3,
    'line-opacity': paint.opacity ?? 1,
    ...(paint.dashArray
      ? { 'line-dasharray': [...paint.dashArray] as NonNullable<LineLayerSpecification['paint']>['line-dasharray'] }
      : {}),
  };
}

function fillPaint(paint: VeitPaint): NonNullable<FillLayerSpecification['paint']> {
  return {
    'fill-color': paint.fillColor ?? paint.color ?? '#2563eb',
    'fill-opacity': paint.fillOpacity ?? 0.2,
  };
}

function upsertSource(map: MapLibreMap, sourceId: string, data: VeitGeoFeatureData): void {
  const payload = data as GeoJsonData;
  const existing = map.getSource(sourceId) as GeoJSONSource | undefined;
  if (existing) {
    void existing.setData(payload);
    return;
  }
  map.addSource(sourceId, { type: 'geojson', data: payload });
}

function upsertLine(map: MapLibreMap, layerId: string, sourceId: string, paint: VeitPaint): void {
  const next = linePaint(paint);
  if (map.getLayer(layerId)) {
    map.setPaintProperty(layerId, 'line-color', next['line-color']);
    map.setPaintProperty(layerId, 'line-width', next['line-width']);
    map.setPaintProperty(layerId, 'line-opacity', next['line-opacity']);
    if (next['line-dasharray']) map.setPaintProperty(layerId, 'line-dasharray', next['line-dasharray']);
    return;
  }
  map.addLayer({ id: layerId, type: 'line', source: sourceId, paint: next });
}

function upsertFill(map: MapLibreMap, layerId: string, sourceId: string, paint: VeitPaint): void {
  const next = fillPaint(paint);
  if (map.getLayer(layerId)) {
    map.setPaintProperty(layerId, 'fill-color', next['fill-color']);
    map.setPaintProperty(layerId, 'fill-opacity', next['fill-opacity']);
    return;
  }
  map.addLayer({ id: layerId, type: 'fill', source: sourceId, paint: next });
}

function useVeitGeoFeature(
  feature: VeitGeoFeatureData,
  paint: VeitPaint,
  kind: 'line' | 'fill',
  handlers: MapPointerHandlers,
): void {
  const map = useMap();
  const sourceId = `veit-geo-${useId().replace(/:/g, '')}`;
  const featureRef = useRef(feature);
  const paintRef = useRef(paint);
  const handlersRef = useRef(handlers);
  featureRef.current = feature;
  paintRef.current = paint;
  handlersRef.current = handlers;

  const lineId = `${sourceId}-line`;
  const fillId = `${sourceId}-fill`;

  const sync = (target: MapLibreMap) => {
    if (!target.getStyle()) return;
    upsertSource(target, sourceId, featureRef.current);
    const nextPaint = paintRef.current;
    if (kind === 'line') upsertLine(target, lineId, sourceId, nextPaint);
    if (kind === 'fill') {
      upsertFill(target, fillId, sourceId, nextPaint);
      upsertLine(target, lineId, sourceId, nextPaint);
    }
  };

  useMapLayer(sync);

  const featureKey = JSON.stringify(feature);
  const paintKey = JSON.stringify(paint);
  useEffect(() => {
    sync(map);
  }, [map, featureKey, paintKey, kind, sourceId]);

  useEffect(() => {
    const layerIds = kind === 'fill' ? [fillId, lineId] : [lineId];
    const onClick = (event: MapLayerMouseEvent) => {
      event.originalEvent.stopPropagation();
      handlersRef.current.onClick?.(pointerEvent(event));
    };
    const onMove = (event: MapLayerMouseEvent) => {
      if (handlersRef.current.onClick || handlersRef.current.onHover) {
        map.getCanvas().style.cursor = 'pointer';
      }
      handlersRef.current.onHover?.(pointerEvent(event));
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = '';
      handlersRef.current.onLeave?.();
    };
    const arm = () => {
      for (const id of layerIds) {
        if (!map.getLayer(id)) continue;
        map.on('click', id, onClick);
        map.on('mousemove', id, onMove);
        map.on('mouseleave', id, onLeave);
      }
    };
    const disarm = () => {
      for (const id of layerIds) {
        map.off('click', id, onClick);
        map.off('mousemove', id, onMove);
        map.off('mouseleave', id, onLeave);
      }
    };
    const onStyle = () => {
      disarm();
      arm();
    };
    arm();
    map.on('style.load', onStyle);
    return () => {
      map.off('style.load', onStyle);
      disarm();
      if (map.getCanvas()) map.getCanvas().style.cursor = '';
    };
  }, [map, kind, lineId, fillId]);
}

export type VeitPathProps = {
  positions: readonly VeitLngLatInput[];
  paint?: VeitPaint;
  onClick?: (event: VeitMapPointerEvent) => void;
  onHover?: (event: VeitMapPointerEvent) => void;
  onLeave?: () => void;
};

function lineFeature(positions: readonly VeitLngLatInput[]): VeitLineFeature {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: positions.map((position) => veitLngLatPair(position)) },
  };
}

export function VeitPolyline({ positions, paint = {}, onClick, onHover, onLeave }: VeitPathProps) {
  useVeitGeoFeature(lineFeature(positions), paint, 'line', { onClick, onHover, onLeave });
  return null;
}

function ringFeature(ring: readonly (readonly [number, number])[]): VeitPolygonFeature {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring.map((pair) => [pair[0], pair[1]])] },
  };
}

export function VeitPolygon({ positions, paint = {}, onClick, onHover, onLeave }: VeitPathProps) {
  const ring = positions.map((position) => veitLngLatPair(position));
  const closed = ring.length > 0 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
    ? [...ring, ring[0]]
    : ring;
  useVeitGeoFeature(ringFeature(closed), paint, 'fill', { onClick, onHover, onLeave });
  return null;
}

/** Circle on the ground. `radiusMeters` is geodesic, not screen pixels. */
export function VeitCircle({
  center,
  radiusMeters,
  paint = {},
  onClick,
  onHover,
  onLeave,
}: {
  center: VeitLngLatInput;
  radiusMeters: number;
  paint?: VeitPaint;
  onClick?: (event: VeitMapPointerEvent) => void;
  onHover?: (event: VeitMapPointerEvent) => void;
  onLeave?: () => void;
}) {
  useVeitGeoFeature(ringFeature(geodesicRing(veitLngLat(center), radiusMeters)), paint, 'fill', {
    onClick,
    onHover,
    onLeave,
  });
  return null;
}

function geodesicRing(center: VeitLngLat, radiusMeters: number, steps = 64): [number, number][] {
  const lat = (center.lat * Math.PI) / 180;
  const lng = (center.lng * Math.PI) / 180;
  const angular = radiusMeters / 6378137;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * Math.PI * 2;
    const lat2 = Math.asin(
      Math.sin(lat) * Math.cos(angular) + Math.cos(lat) * Math.sin(angular) * Math.cos(bearing),
    );
    const lng2 =
      lng +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat),
        Math.cos(angular) - Math.sin(lat) * Math.sin(lat2),
      );
    ring.push([(((lng2 * 180) / Math.PI + 540) % 360) - 180, (lat2 * 180) / Math.PI]);
  }
  return ring;
}

export type VeitPopupProps = {
  children?: ReactNode;
  closeButton?: boolean;
};

/** Popup body for {@link VeitMarker}. Renders its children into the MapLibre popup, not `null`. */
export function VeitPopup({ children }: VeitPopupProps) {
  return <>{children}</>;
}

function takePopup(children: ReactNode): { body: ReactNode[]; popup: ReactNode | null; closeButton: boolean } {
  const body: ReactNode[] = [];
  let popup: ReactNode | null = null;
  let closeButton = true;
  for (const child of Children.toArray(children)) {
    if (isValidElement<VeitPopupProps>(child) && child.type === VeitPopup) {
      popup = child.props.children ?? null;
      closeButton = child.props.closeButton ?? true;
      continue;
    }
    body.push(child);
  }
  return { body, popup, closeButton };
}

export type VeitMarkerProps = {
  position: VeitLngLatInput;
  draggable?: boolean;
  onClick?: (lngLat: VeitLngLat) => void;
  onDragEnd?: (lngLat: VeitLngLat) => void;
  children?: ReactNode;
};

export function VeitMarker({ position, draggable = false, onClick, onDragEnd, children }: VeitMarkerProps) {
  const map = useMap();
  const { body, popup, closeButton } = takePopup(children);
  const positionRef = useRef(position);
  const bodyRef = useRef<ReactNode>(body);
  const popupRef = useRef<ReactNode | null>(popup);
  const closeButtonRef = useRef(closeButton);
  const onClickRef = useRef(onClick);
  const onDragEndRef = useRef(onDragEnd);
  const renderRef = useRef<(() => void) | null>(null);
  positionRef.current = position;
  bodyRef.current = body.length > 0 ? body : <span className="block size-3 rounded-full border border-white bg-primary" />;
  popupRef.current = popup;
  closeButtonRef.current = closeButton;
  onClickRef.current = onClick;
  onDragEndRef.current = onDragEnd;

  useEffect(() => {
    const element = document.createElement('div');
    const popupMount = document.createElement('div');
    const contentRoot = createRoot(element);
    const popupRoot = createRoot(popupMount);
    let popupControl: maplibregl.Popup | null = null;
    let popupCloseButton: boolean | null = null;
    const marker = new maplibregl.Marker({ element, draggable })
      .setLngLat(veitLngLatPair(positionRef.current))
      .addTo(map);
    const onElementClick = (event: MouseEvent) => {
      event.stopPropagation();
      onClickRef.current?.(veitLngLat(marker.getLngLat()));
    };
    const onMarkerDragEnd = () => {
      onDragEndRef.current?.(veitLngLat(marker.getLngLat()));
    };
    element.addEventListener('click', onElementClick);
    marker.on('dragend', onMarkerDragEnd);
    const render = () => {
      contentRoot.render(bodyRef.current);
      const popupNode = popupRef.current;
      if (popupNode == null) {
        if (marker.getPopup()) marker.setPopup(null);
        return;
      }
      popupRoot.render(popupNode);
      if (!popupControl || popupCloseButton !== closeButtonRef.current) {
        popupCloseButton = closeButtonRef.current;
        popupControl = new maplibregl.Popup({ offset: 16, closeButton: popupCloseButton }).setDOMContent(popupMount);
        marker.setPopup(popupControl);
      }
    };
    renderRef.current = render;
    render();
    return () => {
      renderRef.current = null;
      element.removeEventListener('click', onElementClick);
      marker.off('dragend', onMarkerDragEnd);
      marker.remove();
      unmountRoot(contentRoot);
      unmountRoot(popupRoot);
    };
  }, [map, draggable]);

  useEffect(() => {
    renderRef.current?.();
  });

  return null;
}

function unmountRoot(root: Root): void {
  queueMicrotask(() => root.unmount());
}
