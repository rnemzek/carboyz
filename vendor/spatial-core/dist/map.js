import { getCellPolygon, latLngToCell, DEFAULT_RESOLUTION } from "./h3.js";
/** Content shown in a hover tooltip/popup: the feature's rich synopsis card, falling back to its title. */
export function resolveHoverContent(feature) {
    return feature.synopsisCardHtml ?? feature.title;
}
/** Builds the deduplicated H3 hexagon overlay covering every geocoded feature in a layer. */
export function featuresToHexCellCollection(layerConfig, resolution = DEFAULT_RESOLUTION) {
    const cells = new Set();
    for (const feature of layerConfig.features) {
        if (!feature.coordinates)
            continue;
        cells.add(latLngToCell(feature.coordinates.lat, feature.coordinates.lng, resolution));
    }
    return {
        type: "FeatureCollection",
        features: Array.from(cells, (cell) => ({
            type: "Feature",
            id: cell,
            geometry: getCellPolygon(cell),
            properties: { cell },
        })),
    };
}
const hexLayerId = (layerId) => `${layerId}-hex`;
const hexSourceId = (layerId) => `${layerId}-hex-source`;
function attachMarker(feature, map, options) {
    if (!feature.coordinates)
        return null;
    const { overlay, MarkerClass } = options;
    const element = overlay.renderMarker(feature);
    element.addEventListener("click", (event) => {
        event.stopPropagation();
        overlay.onNodeClick?.(feature);
    });
    element.addEventListener("mouseenter", () => overlay.onNodeHover?.(feature));
    element.addEventListener("mouseleave", () => overlay.onNodeLeave?.());
    const marker = new MarkerClass({ element });
    marker.setLngLat([feature.coordinates.lng, feature.coordinates.lat]);
    marker.addTo(map);
    return marker;
}
/**
 * Renders a LayerConfig onto a MapLibre/Mapbox-GL-compatible map instance: one DOM marker per feature
 * (appearance and behavior owned by the domain `overlay`), an optional H3 hexagon overlay beneath them,
 * and a background-click listener isolated from node clicks via `stopPropagation`.
 */
export function renderTopicLayer(map, layerConfig, options) {
    const markers = new Map();
    for (const feature of layerConfig.features) {
        const marker = attachMarker(feature, map, options);
        if (marker)
            markers.set(feature.id, marker);
    }
    let hexHandle;
    if (options.showH3Overlay) {
        const hexSource = hexSourceId(layerConfig.layerId);
        const hexLayer = hexLayerId(layerConfig.layerId);
        map.addSource(hexSource, {
            type: "geojson",
            data: featuresToHexCellCollection(layerConfig, options.h3Resolution),
        });
        map.addLayer({
            id: hexLayer,
            type: "fill",
            source: hexSource,
            paint: {
                "fill-color": layerConfig.style.pinColor,
                "fill-opacity": 0.15,
                "fill-outline-color": layerConfig.style.pinColor,
            },
        });
        hexHandle = { hexLayerId: hexLayer, hexSourceId: hexSource };
    }
    const handleBackgroundClick = () => options.overlay.onMapBackgroundClick?.();
    map.on("click", handleBackgroundClick);
    return {
        hexLayerId: hexHandle?.hexLayerId,
        hexSourceId: hexHandle?.hexSourceId,
        destroy() {
            map.off("click", handleBackgroundClick);
            for (const marker of markers.values())
                marker.remove();
            markers.clear();
            if (hexHandle) {
                if (map.getLayer(hexHandle.hexLayerId))
                    map.removeLayer(hexHandle.hexLayerId);
                map.removeSource(hexHandle.hexSourceId);
            }
        },
    };
}
/**
 * Re-renders a layer already added via renderTopicLayer with updated feature data: swaps out all
 * markers for the new feature list and refreshes the H3 hex overlay data in place.
 */
export function updateTopicLayer(map, layerConfig, handle, options) {
    handle.destroy();
    const rerendered = renderTopicLayer(map, layerConfig, options);
    handle.hexLayerId = rerendered.hexLayerId;
    handle.hexSourceId = rerendered.hexSourceId;
    handle.destroy = rerendered.destroy;
}
