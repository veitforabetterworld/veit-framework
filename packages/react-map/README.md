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
  world3d={world3d}            // anything with attach(map) / dispose(map); a later value is attached
  config={{ terrain: { exaggeration: 1.4 } }} // this map only, over configureMap
  mapOptions={{ maxZoom: 20 }} // passed to new maplibregl.Map
  onStyleReady={(map, reason) => { /* add host layers; runs after every style load */ }}
  onMapReady={(map) => { /* once */ }}
>
  <MyOverlay />                {/* useMap() / useMapLayer() inside */}
</VeitMap>
```

- `projection`, `terrain`, `buildings3d`, `liveSun` and `world3d` apply on style load and again when the prop changes.
- `onStyleReady` runs after the first load and after every basemap or theme switch. Ordinary layers and sources survive a switch. Image sources and custom layers do not; put those in `useMapLayer`.
- `useMap()` / `useVeitMap()` / `useMapEvent()` / `useMapLayer()` for children, `ref.getMap()` from outside.
- `devHandle` is removed from `window` when the map unmounts.
## BasemapSwitcher

`BasemapSwitcher` is a button group, one button per entry in `basemaps` plus `extraBasemaps`. It is controlled: pass the current id and `onChange`. The switcher does not call `setStyle`. `<VeitMap basemap={id}>` owns the style change and keeps the camera and host layers.

## Search

Geocoding stays in the host. Hochwasserdienst `MapSearch` is a combobox over `GET /v1/search/suggest` and then `map.flyTo`. `@veit/map` has no geocoder.

- `BasemapSwitcher` is an optional button group; hosts can build their own from `basemaps`.
- `devHandle="__myMap"` puts the map on `window` for console probes. Pass it in dev builds only.
