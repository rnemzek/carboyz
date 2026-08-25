import { cellToBoundary as h3CellToBoundary, gridDisk as h3GridDisk, latLngToCell as h3LatLngToCell } from "h3-js";
/** Default H3 resolution used across the engine (~0.46 km2 hexagons). */
export const DEFAULT_RESOLUTION = 8;
/** Index a lat/lng point to its H3 cell at the given resolution (default res 8). */
export function latLngToCell(lat, lng, resolution = DEFAULT_RESOLUTION) {
    return h3LatLngToCell(lat, lng, resolution);
}
/** All cells within `radius` grid steps of `cell`, including `cell` itself. */
export function gridDisk(cell, radius) {
    return h3GridDisk(cell, radius);
}
/** Convert an H3 cell to a GeoJSON Polygon (ring in [lng, lat] order, closed). */
export function cellToBoundary(cell) {
    const boundary = h3CellToBoundary(cell, true);
    return {
        type: "Polygon",
        coordinates: [boundary.map(([lng, lat]) => [lng, lat])],
    };
}
/** Alias for cellToBoundary, matching the naming used by map-rendering call sites. */
export const getCellPolygon = cellToBoundary;
