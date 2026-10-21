# @veit/map

MapLibre toolkit without React. Source-exported like the other packages (`exports` point at `src`).

**Peer dependencies:** `maplibre-gl` (^5.24). `three` only for `@veit/map/world3d`.

## What is in it

- **Basemaps, vector first.** `osm` (OpenFreeMap), `satellite` (Esri + vector labels), `topo` (OpenTopoMap raster), `official` (basemap.de vector, Germany only), `cadastral` (state cadastral maps on basemap.de). Add your own with `rasterBasemap({...})` or a `BasemapDefinition`.
- **`createBasemapController(map, options)`** switches the whole style for a basemap or theme change and carries everything the host added (layers, sources, terrain, sky, light, projection) into the new style.
- **Cadastral maps of the 16 states** with zoom tiers (overview / ALKIS) and state lookup by border polygon. Source: plenivo.
- **Globe, live sun light, terrain, 3D buildings, elevation profile** (`elevationProfile(map, line)` samples `queryTerrainElevation`).
- **`@veit/map/world3d`:** three.js scene with trees, fences, hedges, power lines, roads and trains. Host content plugs in as `World3dPlugin`.

## Configure once

```ts
import { configureMap } from '@veit/map';

configureMap({
  terrain: { exaggeration: 1.15 },
  world3d: { detailUrl: ([w, s, e, n]) => `/api/osm/barriers?west=${w}&south=${s}&east=${e}&north=${n}` },
  overlayAnchors: ['flood-depth-raster', 'stations-points'], // new layers (buildings) go below the first one on the map
  topLayers: ['stations-points'], // stay on top after the 3D world raised its layers
});
```

Without `detailUrl` the 3D world skips fences, hedges, single trees and power lines.

## Zoom

Leaflet zoom = MapLibre zoom + 1. `tileZoomOf(map.getZoom())` does that conversion for the state services.

## Known limits

- `official` and `cadastral` show data only inside Germany (basemap.de has no data elsewhere).
- No keyless vector style for topography exists, so `topo` stays a raster.
