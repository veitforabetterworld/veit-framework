# @veit/react-map

`<VeitMap>` on top of `@veit/map`.

**Peer dependencies:** `react`, `maplibre-gl`, `@veit/map`, `@veit/react-controls` (for `BasemapSwitcher`).

```tsx
<VeitMap
  basemap={basemap}            // controlled, the host persists it
  extraBasemaps={[landuse]}    // after the built-ins
  theme={theme}                // 'light' | 'dark', switching keeps camera and host layers
  projection="globe"
  initialView={{ center: [10.45, 51.16], zoom: 6.2, pitch: 40 }}
  world3d={world3d}            // anything with attach(map) / dispose(map)
  mapOptions={{ maxZoom: 20 }} // passed to new maplibregl.Map
  onStyleReady={(map, reason) => { /* add host layers; runs after every style load */ }}
  onMapReady={(map) => { /* once */ }}
>
  <MyOverlay />                {/* useMap() inside */}
</VeitMap>
```

- `onStyleReady` runs after the first load and after every basemap or theme switch. Layers and sources survive a switch; use it for things MapLibre cannot keep (images, custom layers).
- `useMap()` / `useVeitMap()` / `useMapEvent()` for children, `ref.getMap()` from outside.
- `BasemapSwitcher` is an optional button group; hosts can build their own from `basemaps`.
- `devHandle="__myMap"` puts the map on `window` for console probes. Pass it in dev builds only.
