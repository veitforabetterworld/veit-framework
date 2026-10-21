import type { Map as MapLibreMap } from "maplibre-gl";
import { attachEarlierWaterways } from "../earlierWaterways.js";
import type { MapTheme } from "../types.js";

const LABEL = "#e8eaef";
const LABEL_HALO = "rgba(8,10,14,0.92)";
const ROAD = "#8b95a3";
const ROAD_STRONG = "#d5dbe3";
const CASING = "#9aa3b0";
const BOUNDARY = "#b7c0cc";
const WATER = "#3494d4";
const WATER_LINE = "#8fd4ff";
const WATER_LABEL = "#d7ebf8";
const LIGHT_WATER = "#3d86c0";
const LIGHT_WATER_LINE = "#1d5f96";
const LIGHT_WATER_LABEL = "#12365c";

/** Gleiche Stufung wie OpenFreeMap Positron: Stadt deutlich größer als Ort. */
const PLACE_TEXT_SIZE: Record<string, unknown[]> = {
  place_other: ["interpolate", ["linear"], ["zoom"], 8, 9, 12, 10],
  place_suburb: ["interpolate", ["linear"], ["zoom"], 8, 9, 12, 10],
  place_village: ["interpolate", ["exponential", 1.2], ["zoom"], 7, 10, 11, 12],
  place_town: ["interpolate", ["exponential", 1.2], ["zoom"], 7, 12, 11, 14],
  place_city: ["interpolate", ["exponential", 1.2], ["zoom"], 4, 11, 7, 13, 11, 18],
  place_city_large: ["interpolate", ["exponential", 1.2], ["zoom"], 4, 12, 7, 14, 11, 20],
};

const WATERWAY_WIDTH: unknown[] = [
  "interpolate",
  ["exponential", 1.4],
  ["zoom"],
  6,
  ["match", ["get", "class"], "river", 2.4, "canal", 1.8, 0.8],
  10,
  ["match", ["get", "class"], "river", 5.5, "canal", 3.4, 1.6],
  14,
  ["match", ["get", "class"], "river", 9, "canal", 5.5, 2.8],
];

function setPaint(map: MapLibreMap, layerId: string, prop: string, value: string | number | unknown[]): void {
  if (!map.getLayer(layerId)) return;
  map.setPaintProperty(layerId, prop as "line-color", value as string);
}

function setLayout(map: MapLibreMap, layerId: string, prop: string, value: string | number | unknown[]): void {
  if (!map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, prop as "text-size", value as string);
}

function emphasizeWater(map: MapLibreMap, theme: MapTheme): void {
  const dark = theme === "dark";
  const line = dark ? WATER_LINE : LIGHT_WATER_LINE;
  setPaint(map, "water", "fill-color", dark ? WATER : LIGHT_WATER);
  setPaint(map, "water", "fill-opacity", 1);
  setPaint(map, "waterway", "line-color", line);
  setPaint(map, "waterway", "line-width", WATERWAY_WIDTH);
  setPaint(map, "waterway", "line-opacity", 1);
  attachEarlierWaterways(map, line);
  if (dark) {
    setPaint(map, "water_name", "text-color", WATER_LABEL);
    setPaint(map, "water_name", "text-halo-color", LABEL_HALO);
    setPaint(map, "water_name", "text-halo-width", 1.2);
    return;
  }
  for (const id of ["water_name_point_label", "water_name_line_label", "waterway_line_label"]) {
    setPaint(map, id, "text-color", LIGHT_WATER_LABEL);
    setPaint(map, id, "text-halo-color", "#ffffff");
    setPaint(map, id, "text-halo-width", 1.6);
  }
}

/**
 * OpenFreeMap Dark hält Ortsnamen auf einer Schriftgröße und zeichnet Wasser fast wie den Hintergrund.
 * Positron zeichnet Wasser grau. Beides wird an die helle Ortsstufung und ein kräftiges Blau angeglichen.
 */
export function applyOsmTheme(map: MapLibreMap, theme: MapTheme): void {
  emphasizeWater(map, theme);
  if (theme !== "dark") return;
  setPaint(map, "background", "background-color", "#10141a");
  for (const [id, size] of Object.entries(PLACE_TEXT_SIZE)) {
    setLayout(map, id, "text-size", size);
  }
  for (const id of ["place_village", "place_town", "place_city", "place_city_large"]) {
    setLayout(map, id, "text-transform", "none");
  }
  setLayout(map, "place_city_large", "text-font", ["Noto Sans Bold"]);
  for (const id of ["highway_name_other", "highway_name_motorway"]) {
    setPaint(map, id, "text-color", LABEL);
    setPaint(map, id, "text-halo-color", LABEL_HALO);
    setPaint(map, id, "text-halo-width", 1.4);
  }
  for (const id of [
    "place_other",
    "place_suburb",
    "place_village",
    "place_town",
    "place_city",
    "place_city_large",
    "place_state",
    "place_country_other",
    "place_country_minor",
    "place_country_major",
  ]) {
    setPaint(map, id, "text-color", LABEL);
    setPaint(map, id, "text-halo-color", LABEL_HALO);
    setPaint(map, id, "text-halo-width", 1.5);
  }
  for (const id of ["highway_path", "highway_minor", "highway_major_subtle", "highway_motorway_subtle"]) {
    setPaint(map, id, "line-color", ROAD);
  }
  for (const id of ["highway_major_casing", "highway_motorway_casing"]) {
    setPaint(map, id, "line-color", CASING);
  }
  setPaint(map, "highway_major_inner", "line-color", ROAD_STRONG);
  setPaint(map, "highway_motorway_inner", "line-color", [
    "interpolate",
    ["linear"],
    ["zoom"],
    5.8,
    "hsla(210,18%,86%,0.85)",
    6,
    ROAD_STRONG,
  ]);
  for (const id of ["railway", "railway_minor", "railway_transit"]) {
    setPaint(map, id, "line-color", ROAD);
  }
  for (const id of ["boundary_state", "boundary_country_z0-4", "boundary_country_z5-"]) {
    setPaint(map, id, "line-color", BOUNDARY);
  }
  setPaint(map, "landuse_residential", "fill-color", "#222833");
  setPaint(map, "landcover_wood", "fill-color", "#1c3330");
  setPaint(map, "landuse_park", "fill-color", "#1a302c");
  setPaint(map, "building", "fill-outline-color", "#3c4656");
}
